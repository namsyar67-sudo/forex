import { NextResponse } from "next/server";
import { analyzePair, buildAnalysisSummary } from "@/lib/market/analysis";
import { getCandles } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzeMultiTimeframe } from "@/lib/multi-timeframe/engine";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  // Phase 1: capture BEFORE snapshot (most recent existing, or current state labeled "before")
  const analysis = await analyzePair(sym);
  if (!analysis) {
    return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
  }
  const summary = buildAnalysisSummary(analysis);
  const { candles } = await getCandles(sym, "h1", 150);
  const smc = candles.length >= 30 ? analyzeSmartMoney(sym, "h1", candles) : null;
  const mtf = await analyzeMultiTimeframe(sym);

  // Look for the most recent "before" snapshot to use as the comparison baseline
  const beforeRows = await db.reanalysisSnapshot.findMany({
    where: { symbol: sym, phase: "before" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const beforeSnapshot = beforeRows[0];

  // Save current as the new "before" snapshot for next comparison
  // NOTE: omit the heavy candle arrays to avoid memory bloat
  const lightAnalysis = {
    symbol: analysis.symbol,
    price: analysis.price,
    changePct: analysis.changePct,
    trend: analysis.trend,
    rsi: analysis.rsi,
    adx: analysis.adx,
    atrPct: analysis.atrPct,
    signal: analysis.signal,
    signalScore: analysis.signalScore,
    riskScore: analysis.riskScore,
    confidence: analysis.confidence,
    support: analysis.support,
    resistance: analysis.resistance,
  };
  const currentSnapshot = await db.reanalysisSnapshot.create({
    data: {
      symbol: sym,
      phase: "before",
      trend: analysis.trend,
      confidence: summary.confidence,
      signalScore: analysis.signalScore,
      riskScore: summary.riskScore,
      rsi: analysis.rsi,
      atrPct: analysis.atrPct,
      sentiment: smc?.summary.bias || "neutral",
      liquidity: analysis.liquidity,
      orderBlocks: smc?.summary.activeOrderBlocks || 0,
      fvgs: smc?.summary.activeFVGs || 0,
      bosCount: smc?.breaks.length || 0,
      newsImpact: 0,
      snapshot: JSON.stringify({ analysis: lightAnalysis, summary, smcSummary: smc ? { bias: smc.summary.bias, biasStrength: smc.summary.biasStrength, marketStructure: smc.summary.marketStructure } : null, mtf: { decision: mtf.overall.decision, confidence: mtf.overall.confidence, alignment: mtf.overall.alignment, trendBias: mtf.overall.trendBias } }),
    },
  });

  // The "after" is the current state; the "before" is the previous snapshot
  const comparison = beforeSnapshot
    ? {
        trendBefore: beforeSnapshot.trend,
        trendAfter: currentSnapshot.trend,
        confidenceBefore: beforeSnapshot.confidence,
        confidenceAfter: currentSnapshot.confidence,
        signalScoreBefore: beforeSnapshot.signalScore,
        signalScoreAfter: currentSnapshot.signalScore,
        riskBefore: beforeSnapshot.riskScore,
        riskAfter: currentSnapshot.riskScore,
        rsiBefore: beforeSnapshot.rsi,
        rsiAfter: currentSnapshot.rsi,
        sentimentBefore: beforeSnapshot.sentiment,
        sentimentAfter: currentSnapshot.sentiment,
        liquidityBefore: beforeSnapshot.liquidity,
        liquidityAfter: currentSnapshot.liquidity,
        orderBlocksBefore: beforeSnapshot.orderBlocks,
        orderBlocksAfter: currentSnapshot.orderBlocks,
        fvgsBefore: beforeSnapshot.fvgs,
        fvgsAfter: currentSnapshot.fvgs,
        bosBefore: beforeSnapshot.bosCount,
        bosAfter: currentSnapshot.bosCount,
        recommendationBefore: (JSON.parse(beforeSnapshot.snapshot).summary?.action) || "hold",
        recommendationAfter: summary.action,
        timeDelta: currentSnapshot.createdAt.getTime() - beforeSnapshot.createdAt.getTime(),
      }
    : null;

  // Record a decision timeline entry
  await db.decisionTimelineEntry.create({
    data: {
      symbol: sym,
      action: summary.action,
      confidence: summary.confidence,
      reason: summary.summary,
      signalScore: analysis.signalScore,
      trend: analysis.trend,
      context: JSON.stringify({
        rsi: analysis.rsi,
        adx: analysis.adx,
        atrPct: analysis.atrPct,
        smcBias: smc?.summary.bias,
        mtfAlignment: mtf.overall.alignment,
      }),
    },
  });

  return NextResponse.json({
    symbol: sym,
    current: {
      analysis: lightAnalysis,
      summary,
      smc: smc ? {
        bias: smc.summary.bias,
        biasStrength: smc.summary.biasStrength,
        marketStructure: smc.summary.marketStructure,
        activeOrderBlocks: smc.summary.activeOrderBlocks,
        activeFVGs: smc.summary.activeFVGs,
      } : null,
      mtf: {
        decision: mtf.overall.decision,
        confidence: mtf.overall.confidence,
        alignment: mtf.overall.alignment,
        trendBias: mtf.overall.trendBias,
      },
    },
    comparison,
    timestamp: Date.now(),
  });
}
