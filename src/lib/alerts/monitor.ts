/**
 * Advanced Alert Monitor
 * Scans market structure for alert conditions and fires alerts.
 * Designed to be called periodically (e.g. every 30s via the dashboard).
 */
import { db } from "@/lib/db";
import { getCandles, getAllQuotes } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzePair } from "@/lib/market/analysis";
import { DEFAULT_INSTRUMENTS } from "@/lib/market/instruments";

export interface AlertDetection {
  type: string;
  symbol: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
}

interface LastState {
  bosCount: number;
  chochCount: number;
  fvgCount: number;
  obCount: number;
  trend: string;
  confidence: number;
  riskScore: number;
}

declare global {
  var __alertLastStates: Record<string, LastState> | undefined;
}

function getStates(): Record<string, LastState> {
  if (!global.__alertLastStates) global.__alertLastStates = {};
  return global.__alertLastStates;
}

export async function runAlertMonitor(): Promise<AlertDetection[]> {
  const detections: AlertDetection[] = [];
  const states = getStates();
  const enabledRules = await db.alertRule.findMany({ where: { enabled: true } });
  const ruleTypes = new Set(enabledRules.map((r) => r.type));

  const { quotes } = await getAllQuotes();
  const symbols = DEFAULT_INSTRUMENTS.map((i) => i.symbol).filter((s) => quotes[s]);

  for (const symbol of symbols) {
    try {
      const { candles } = await getCandles(symbol, "h1", 300);
      if (candles.length < 30) continue;
      const smc = analyzeSmartMoney(symbol, "h1", candles);
      const analysis = await analyzePair(symbol);
      if (!analysis) continue;

      const prev = states[symbol];
      const current: LastState = {
        bosCount: smc.breaks.filter((b) => b.type === "BOS" || b.type === "EXTERNAL_BOS" || b.type === "INTERNAL_BOS").length,
        chochCount: smc.breaks.filter((b) => b.type === "CHOCH").length,
        fvgCount: smc.fairValueGaps.filter((f) => !f.filled).length,
        obCount: smc.orderBlocks.filter((o) => !o.mitigated).length,
        trend: analysis.trend,
        confidence: analysis.confidence,
        riskScore: analysis.riskScore,
      };

      if (prev) {
        if (ruleTypes.has("bos") && current.bosCount > prev.bosCount) {
          const lastBOS = smc.summary.lastBOS;
          detections.push({
            type: "bos",
            symbol,
            severity: "info",
            title: `BOS on ${symbol}`,
            message: `Break of Structure (${lastBOS?.direction}). ${analysis.trend} trend, confidence ${analysis.confidence}%.`,
          });
        }
        if (ruleTypes.has("choch") && current.chochCount > prev.chochCount) {
          const lastCHOCH = smc.summary.lastCHOCH;
          detections.push({
            type: "choch",
            symbol,
            severity: "warning",
            title: `CHOCH on ${symbol}`,
            message: `Change of Character (${lastCHOCH?.direction}). Potential trend reversal. Monitor closely.`,
          });
        }
        if (ruleTypes.has("fvg") && current.fvgCount > prev.fvgCount) {
          detections.push({
            type: "fvg",
            symbol,
            severity: "info",
            title: `FVG on ${symbol}`,
            message: `New Fair Value Gap detected. ${smc.summary.activeFVGs} active FVGs. Price may rebalance to fill.`,
          });
        }
        if (ruleTypes.has("order_block") && current.obCount > prev.obCount) {
          detections.push({
            type: "order_block",
            symbol,
            severity: "info",
            title: `Order Block on ${symbol}`,
            message: `New Order Block formed. ${smc.summary.activeOrderBlocks} active OBs. Watch for mitigation.`,
          });
        }
        if (ruleTypes.has("trend") && current.trend !== prev.trend) {
          detections.push({
            type: "trend",
            symbol,
            severity: "critical",
            title: `Trend changed on ${symbol}`,
            message: `Trend shifted from ${prev.trend} to ${current.trend}. Reassess positions.`,
          });
        }
        if (ruleTypes.has("confidence") && Math.abs(current.confidence - prev.confidence) >= 20) {
          detections.push({
            type: "confidence",
            symbol,
            severity: "info",
            title: `Confidence shift on ${symbol}`,
            message: `Confidence moved from ${prev.confidence}% to ${current.confidence}% (Δ${current.confidence - prev.confidence}).`,
          });
        }
        if (ruleTypes.has("risk") && current.riskScore > 60 && current.riskScore > prev.riskScore + 10) {
          detections.push({
            type: "risk",
            symbol,
            severity: "warning",
            title: `Risk elevated on ${symbol}`,
            message: `Risk score ${current.riskScore}/100 (was ${prev.riskScore}). Reduce position size or stand aside.`,
          });
        }
        if (ruleTypes.has("level_proximity")) {
          const q = quotes[symbol];
          if (q) {
            const distToSupport = Math.abs(q.last - analysis.support) / q.last;
            const distToResistance = Math.abs(q.last - analysis.resistance) / q.last;
            if (distToSupport < 0.002) {
              detections.push({
                type: "level_proximity",
                symbol,
                severity: "warning",
                title: `${symbol} near support`,
                message: `Price ${q.last} within 0.2% of support ${analysis.support}. Watch for reaction.`,
              });
            } else if (distToResistance < 0.002) {
              detections.push({
                type: "level_proximity",
                symbol,
                severity: "warning",
                title: `${symbol} near resistance`,
                message: `Price ${q.last} within 0.2% of resistance ${analysis.resistance}. Watch for reaction.`,
              });
            }
          }
        }
      }
      states[symbol] = current;
    } catch {
      // skip symbol on error
    }
  }

  for (const d of detections) {
    const recent = await db.alert.findFirst({
      where: {
        type: d.type,
        symbol: d.symbol,
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!recent) {
      await db.alert.create({
        data: {
          type: d.type,
          symbol: d.symbol,
          severity: d.severity,
          title: d.title,
          message: d.message,
        },
      });
    }
  }

  return detections;
}
