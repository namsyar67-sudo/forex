/**
 * Trade Monitor V3
 * Tracks active signals in real-time and generates trade events.
 * Monitors: price vs TP/SL, confidence changes, BOS/CHOCH, OB breaks,
 * news events, volatility, liquidity, trend changes.
 *
 * Called by the background analyst worker on each loop iteration.
 */
import { db } from "@/lib/db";
import { getAllQuotes, getCandles } from "@/lib/market/client";
import { analyzePair, buildAnalysisSummary } from "@/lib/market/analysis";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { computeNewsImpact } from "@/lib/news-impact/engine";

export interface TradeEventInput {
  signalId: string;
  symbol: string;
  type: string;
  title: string;
  message: string;
  reason: string;
  confidence?: number;
  priority?: "low" | "medium" | "high" | "critical";
}

export async function createTradeEvent(input: TradeEventInput) {
  try {
    await db.tradeEvent.create({
      data: {
        signalId: input.signalId,
        symbol: input.symbol,
        type: input.type,
        title: input.title,
        message: input.message,
        reason: input.reason,
        confidence: input.confidence || null,
        priority: input.priority || "medium",
      },
    });
  } catch {
    // non-fatal
  }
}

interface MonitorState {
  confidence: number;
  smcBias: string;
  bosCount: number;
  chochCount: number;
  obCount: number;
  fvgCount: number;
  trend: string;
  riskScore: number;
  highImpactNews: number;
}

declare global {
  var __tradeMonitorStates: Record<string, MonitorState> | undefined;
}

function getStates(): Record<string, MonitorState> {
  if (!global.__tradeMonitorStates) global.__tradeMonitorStates = {};
  return global.__tradeMonitorStates;
}

export async function monitorActiveSignals() {
  const states = getStates();
  const { quotes } = await getAllQuotes();
  const activeSignals = await db.activeSignal.findMany({
    where: { status: { in: ["active", "tp1_hit", "tp2_hit"] } },
  });

  const newsImpact = await computeNewsImpact();

  for (const signal of activeSignals) {
    const q = quotes[signal.symbol];
    if (!q) continue;

    const isLong = signal.direction === "long";
    const currentPrice = q.last;
    let statusChanged = false;
    let newStatus = signal.status;

    // Check TP1
    if (!signal.tp1Hit) {
      const hit = isLong ? currentPrice >= signal.takeProfit1 : currentPrice <= signal.takeProfit1;
      if (hit) {
        await db.activeSignal.update({
          where: { id: signal.id },
          data: { tp1Hit: true, status: "tp1_hit", currentPrice },
        });
        await createTradeEvent({
          signalId: signal.id,
          symbol: signal.symbol,
          type: "TAKE_PROFIT_HIT",
          title: `🎯 TP1 HIT — ${signal.symbol}`,
          message: `${signal.symbol} reached TP1 at ${signal.takeProfit1.toFixed(q.digits)}. Current: ${currentPrice.toFixed(q.digits)}`,
          reason: "Price reached Take Profit 1. Move Stop Loss to Break Even.",
          confidence: signal.confidence,
          priority: "high",
        });
        await createTradeEvent({
          signalId: signal.id,
          symbol: signal.symbol,
          type: "MOVE_STOP_LOSS",
          title: `📢 Move Stop Loss to Break Even — ${signal.symbol}`,
          message: `TP1 hit. Move SL from ${signal.stopLoss.toFixed(q.digits)} to ${signal.entryPrice.toFixed(q.digits)} (break even).`,
          reason: "Lock in profits by moving stop loss to entry price.",
          confidence: signal.confidence,
          priority: "high",
        });
        statusChanged = true;
        newStatus = "tp1_hit";
      }
    }

    // Check TP2
    if (signal.tp1Hit && !signal.tp2Hit) {
      const hit = isLong ? currentPrice >= signal.takeProfit2 : currentPrice <= signal.takeProfit2;
      if (hit) {
        await db.activeSignal.update({
          where: { id: signal.id },
          data: { tp2Hit: true, status: "tp2_hit", currentPrice },
        });
        await createTradeEvent({
          signalId: signal.id,
          symbol: signal.symbol,
          type: "TAKE_PROFIT_HIT",
          title: `🎯 TP2 HIT — ${signal.symbol}`,
          message: `${signal.symbol} reached TP2 at ${signal.takeProfit2.toFixed(q.digits)}. Current: ${currentPrice.toFixed(q.digits)}`,
          reason: "Price reached Take Profit 2. Consider trailing stop or partial close.",
          confidence: signal.confidence,
          priority: "high",
        });
        statusChanged = true;
        newStatus = "tp2_hit";
      }
    }

    // Check TP3 → close as win
    if (signal.tp2Hit && !signal.tp3Hit) {
      const hit = isLong ? currentPrice >= signal.takeProfit3 : currentPrice <= signal.takeProfit3;
      if (hit) {
        const pnlPct = isLong
          ? ((signal.takeProfit3 - signal.entryPrice) / signal.entryPrice) * 100
          : ((signal.entryPrice - signal.takeProfit3) / signal.entryPrice) * 100;
        await db.activeSignal.update({
          where: { id: signal.id },
          data: {
            tp3Hit: true,
            status: "closed_win",
            closedAt: new Date(),
            closeReason: "TP3 reached",
            closePnl: pnlPct,
            currentPrice,
          },
        });
        await createTradeEvent({
          signalId: signal.id,
          symbol: signal.symbol,
          type: "TAKE_PROFIT_HIT",
          title: `✅ TRADE CLOSED — WIN ${signal.symbol}`,
          message: `${signal.symbol} hit TP3 at ${signal.takeProfit3.toFixed(q.digits)}. PnL: +${pnlPct.toFixed(2)}%`,
          reason: "Trend continued to final target. Trade closed as successful.",
          confidence: signal.confidence,
          priority: "high",
        });
        // Save to history
        await db.signalHistory.create({
          data: {
            symbol: signal.symbol,
            direction: signal.direction,
            signalType: signal.signalType,
            entryPrice: signal.entryPrice,
            confidence: signal.confidence,
            qualityScore: signal.qualityScore,
            reasons: signal.reasons,
            summary: signal.summary,
            outcome: "win",
            closePrice: signal.takeProfit3,
            pnlPct,
          },
        });
        continue;
      }
    }

    // Check Stop Loss → close as loss
    const slHit = isLong ? currentPrice <= signal.stopLoss : currentPrice >= signal.stopLoss;
    if (slHit) {
      const pnlPct = isLong
        ? ((signal.stopLoss - signal.entryPrice) / signal.entryPrice) * 100
        : ((signal.entryPrice - signal.stopLoss) / signal.entryPrice) * 100;
      await db.activeSignal.update({
        where: { id: signal.id },
        data: {
          slHit: true,
          status: "closed_loss",
          closedAt: new Date(),
          closeReason: "Stop loss hit",
          closePnl: pnlPct,
          currentPrice,
        },
      });
      await createTradeEvent({
        signalId: signal.id,
        symbol: signal.symbol,
        type: "CLOSE_POSITION",
        title: `❌ TRADE CLOSED — LOSS ${signal.symbol}`,
        message: `${signal.symbol} hit stop loss at ${signal.stopLoss.toFixed(q.digits)}. PnL: ${pnlPct.toFixed(2)}%`,
        reason: "Price reached stop loss level.",
        confidence: signal.confidence,
        priority: "high",
      });
      await db.signalHistory.create({
        data: {
          symbol: signal.symbol,
          direction: signal.direction,
          signalType: signal.signalType,
          entryPrice: signal.entryPrice,
          confidence: signal.confidence,
          qualityScore: signal.qualityScore,
          reasons: signal.reasons,
          summary: signal.summary,
          outcome: "loss",
          closePrice: signal.stopLoss,
          pnlPct,
        },
      });
      continue;
    }

    // Update current price
    if (!statusChanged) {
      await db.activeSignal.update({
        where: { id: signal.id },
        data: { currentPrice },
      });
    }

    // Structure & confidence monitoring (lighter — fetch analysis)
    try {
      const { candles } = await getCandles(signal.symbol, "h1", 120);
      const analysis = await analyzePair(signal.symbol);
      if (!analysis || candles.length < 30) continue;

      const smc = analyzeSmartMoney(signal.symbol, "h1", candles);
      const newConfidence = analysis.confidence;
      const prev = states[signal.id];

      const currentState: MonitorState = {
        confidence: newConfidence,
        smcBias: smc.summary.bias,
        bosCount: smc.breaks.filter(b => b.type === "BOS" || b.type === "EXTERNAL_BOS" || b.type === "INTERNAL_BOS").length,
        chochCount: smc.breaks.filter(b => b.type === "CHOCH").length,
        obCount: smc.summary.activeOrderBlocks,
        fvgCount: smc.summary.activeFVGs,
        trend: analysis.trend,
        riskScore: analysis.riskScore,
        highImpactNews: newsImpact.highImpactCount,
      };

      if (prev) {
        // Confidence drop
        if (newConfidence < prev.confidence - 15) {
          await createTradeEvent({
            signalId: signal.id,
            symbol: signal.symbol,
            type: "CONFIDENCE_CHANGED",
            title: `📢 Confidence Dropped — ${signal.symbol}`,
            message: `Confidence: ${prev.confidence}% → ${newConfidence}% (Δ${newConfidence - prev.confidence})`,
            reason: "Market conditions changed. Re-evaluate position.",
            confidence: newConfidence,
            priority: "high",
          });
        }

        // New BOS
        if (currentState.bosCount > prev.bosCount) {
          const lastBOS = smc.summary.lastBOS;
          await createTradeEvent({
            signalId: signal.id,
            symbol: signal.symbol,
            type: "BOS_DETECTED",
            title: `📢 New BOS — ${signal.symbol}`,
            message: `Break of Structure (${lastBOS?.direction}). Trend continuing.`,
            reason: `New ${lastBOS?.type} in ${lastBOS?.direction} direction.`,
            confidence: newConfidence,
            priority: "medium",
          });
        }

        // New CHOCH
        if (currentState.chochCount > prev.chochCount) {
          const lastCHOCH = smc.summary.lastCHOCH;
          const isAgainst = (lastCHOCH?.direction === "bearish" && isLong) || (lastCHOCH?.direction === "bullish" && !isLong);
          await createTradeEvent({
            signalId: signal.id,
            symbol: signal.symbol,
            type: "CHOCH_DETECTED",
            title: `⚠️ CHOCH Detected — ${signal.symbol}`,
            message: `Change of Character (${lastCHOCH?.direction}). ${isAgainst ? "Against position — consider closing." : "With position — trend accelerating."}`,
            reason: `Trend reversal signal: ${lastCHOCH?.direction} CHOCH.`,
            confidence: newConfidence,
            priority: isAgainst ? "critical" : "medium",
          });
          if (isAgainst) {
            await createTradeEvent({
              signalId: signal.id,
              symbol: signal.symbol,
              type: "CLOSE_POSITION",
              title: `🚫 Close Trade Recommendation — ${signal.symbol}`,
              message: `Trend reversed (CHOCH against position). Consider closing.`,
              reason: "CHOCH indicates potential trend reversal against the trade direction.",
              confidence: newConfidence,
              priority: "critical",
            });
          }
        }

        // Trend change
        if (currentState.trend !== prev.trend) {
          const isAgainst = (currentState.trend === "Bearish" && isLong) || (currentState.trend === "Bullish" && !isLong);
          await createTradeEvent({
            signalId: signal.id,
            symbol: signal.symbol,
            type: "TREND_CHANGE",
            title: `⚠️ Trend Changed — ${signal.symbol}`,
            message: `Trend: ${prev.trend} → ${currentState.trend}. ${isAgainst ? "Against position." : "With position."}`,
            reason: `Trend shifted from ${prev.trend} to ${currentState.trend}.`,
            confidence: newConfidence,
            priority: isAgainst ? "critical" : "medium",
          });
        }

        // Risk elevated
        if (currentState.riskScore > 60 && currentState.riskScore > prev.riskScore + 10) {
          await createTradeEvent({
            signalId: signal.id,
            symbol: signal.symbol,
            type: "RISK_ELEVATED",
            title: `⚠️ Risk Elevated — ${signal.symbol}`,
            message: `Risk score: ${prev.riskScore} → ${currentState.riskScore}. Consider reducing position size.`,
            reason: "Volatility or risk conditions have increased.",
            confidence: newConfidence,
            priority: "high",
          });
        }

        // High impact news appeared
        if (currentState.highImpactNews > prev.highImpactNews + 1) {
          await createTradeEvent({
            signalId: signal.id,
            symbol: signal.symbol,
            type: "HIGH_IMPACT_NEWS",
            title: `📰 High Impact News — ${signal.symbol}`,
            message: `${currentState.highImpactNews} high-impact news items detected. Reduce risk.`,
            reason: "News events increase volatility and uncertainty.",
            confidence: newConfidence,
            priority: "high",
          });
        }

        // OB broken
        if (currentState.obCount < prev.obCount) {
          await createTradeEvent({
            signalId: signal.id,
            symbol: signal.symbol,
            type: "OB_BROKEN",
            title: `📢 Order Block Broken — ${signal.symbol}`,
            message: `Active order blocks: ${prev.obCount} → ${currentState.obCount}.`,
            reason: "An order block was mitigated/broken. Structure may have shifted.",
            confidence: newConfidence,
            priority: "medium",
          });
        }
      }

      states[signal.id] = currentState;
    } catch {
      // skip analysis errors
    }
  }
}
