/**
 * Market Scanner V3
 * Scans all pairs, generates signals, ranks by confidence + quality score.
 * Saves top opportunities. Auto-adds high-confidence pairs to watchlist.
 */
import { db } from "@/lib/db";
import { getAllAnalysisCached } from "@/lib/market/analysis";
import { getAllQuotes } from "@/lib/market/client";
import { computeNewsImpact } from "@/lib/news-impact/engine";
import { analyzeSessions } from "@/lib/session-analysis/engine";
import { computeHeatmap } from "@/lib/heatmap/engine";
import { generateSignal, formatSignalNotification, type TradingSignal } from "@/lib/signal-engine/engine";

export interface ScanResultItem {
  rank: number;
  signal: TradingSignal;
}

export interface ScanOutput {
  results: ScanResultItem[];
  topOpportunities: TradingSignal[];
  newSignals: TradingSignal[];
  timestamp: number;
}

export async function runMarketScan(opts: {
  minConfidence?: number;
  minQualityScore?: number;
  persistSignals?: boolean;
} = {}): Promise<ScanOutput> {
  const minConfidence = opts.minConfidence ?? 65;
  const minQualityScore = opts.minQualityScore ?? 55;
  const persistSignals = opts.persistSignals ?? true;

  const { quotes } = await getAllQuotes();
  // Use cached shared data (don't recompute — these are also computed by other routes)
  let newsImpact: any = { items: [], highImpactCount: 0, topRiskSymbols: [] };
  let sessionAnalysis: any = { sessions: [], currentSession: { name: "Unknown", volMultiplier: 1 }, bestSession: { name: "Unknown", volMultiplier: 1 }, summary: "" };
  let heatmap: any = { currencies: [], topCurrency: null, bottomCurrency: null };

  try { newsImpact = await computeNewsImpact(); } catch { /* skip */ }
  try { sessionAnalysis = await analyzeSessions(); } catch { /* skip */ }
  try { heatmap = await computeHeatmap(); } catch { /* skip */ }

  const signals: TradingSignal[] = [];

  // Use cached analysis (shared with /api/analysis route) to avoid duplicate heavy computation
  const allAnalysis = await getAllAnalysisCached();

  for (const analysis of allAnalysis) {
    if (!quotes[analysis.symbol]) continue;
    try {
      // Lightweight signal generation — skip expensive per-symbol SMC/MTF/PA
      // These will be computed when a signal is actually being monitored
      const signal = generateSignal({
        analysis,
        smc: null,
        priceAction: null,
        mtf: null,
        newsImpact,
        sessionAnalysis,
        heatmap,
      });
      signals.push(signal);
    } catch {
      // skip
    }
  }

  // Sort by quality score then confidence
  signals.sort((a, b) => b.qualityScore - a.qualityScore || b.confidence - a.confidence);

  const results: ScanResultItem[] = signals.map((signal, i) => ({ rank: i + 1, signal }));

  // Top opportunities: quality >= 70 and confidence >= 65 and not WAIT
  const topOpportunities = signals.filter(
    (s) => s.qualityScore >= minQualityScore && s.confidence >= minConfidence && s.signalType !== "WAIT"
  );

  // Persist scan results (top 16)
  if (persistSignals) {
    try {
      // Clear old scan results
      await db.scanResult.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
      });
      for (const item of results.slice(0, 16)) {
        await db.scanResult.create({
          data: {
            symbol: item.signal.symbol,
            confidence: item.signal.confidence,
            qualityScore: item.signal.qualityScore,
            signalType: item.signal.signalType,
            direction: item.signal.direction,
            rank: item.rank,
            reasons: JSON.stringify(item.signal.reasons),
          },
        });
      }
    } catch {
      // non-fatal
    }
  }

  // Create new active signals for high-quality opportunities
  const newSignals: TradingSignal[] = [];
  if (persistSignals) {
    for (const signal of topOpportunities) {
      // Check if there's already an active signal for this symbol
      const existing = await db.activeSignal.findFirst({
        where: {
          symbol: signal.symbol,
          status: { in: ["active", "tp1_hit", "tp2_hit"] },
        },
      });
      if (existing) continue; // don't duplicate

      // Check if we recently created a signal for this symbol (within 15 min)
      const recent = await db.activeSignal.findFirst({
        where: {
          symbol: signal.symbol,
          createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recent) continue;

      try {
        const activeSignal = await db.activeSignal.create({
          data: {
            symbol: signal.symbol,
            direction: signal.direction,
            signalType: signal.signalType,
            entryPrice: signal.entryPrice,
            currentPrice: signal.currentPrice,
            stopLoss: signal.stopLoss,
            takeProfit1: signal.takeProfit1,
            takeProfit2: signal.takeProfit2,
            takeProfit3: signal.takeProfit3,
            riskReward: signal.riskReward,
            confidence: signal.confidence,
            qualityScore: signal.qualityScore,
            expectedDuration: signal.expectedDuration,
            expectedProbability: signal.expectedProbability,
            riskLevel: signal.riskLevel,
            marketSession: signal.marketSession,
            reasons: JSON.stringify(signal.reasons),
            summary: signal.summary,
            indicators: JSON.stringify(signal.indicators),
          },
        });

        // Create notification
        const notif = formatSignalNotification(signal);
        await db.tradeEvent.create({
          data: {
            signalId: activeSignal.id,
            symbol: signal.symbol,
            type: "NEW_SIGNAL",
            title: notif.title,
            message: notif.message,
            reason: signal.reasons.slice(0, 5).join(", "),
            confidence: signal.confidence,
            priority: notif.priority as "low" | "medium" | "high" | "critical",
          },
        });

        // Save to signal history
        await db.signalHistory.create({
          data: {
            symbol: signal.symbol,
            direction: signal.direction,
            signalType: signal.signalType,
            entryPrice: signal.entryPrice,
            confidence: signal.confidence,
            qualityScore: signal.qualityScore,
            reasons: JSON.stringify(signal.reasons),
            summary: signal.summary,
          },
        });

        newSignals.push(signal);
      } catch {
        // non-fatal
      }
    }
  }

  return {
    results,
    topOpportunities,
    newSignals,
    timestamp: Date.now(),
  };
}
