/**
 * Chief AI Agent
 * Collects reports from all specialized agents, computes a unified confidence score,
 * and issues the final decision with full reasoning.
 *
 * The Chief doesn't analyze the market directly — it orchestrates the agents
 * and aggregates their consensus.
 */
import type { AgentContext, AgentReport, ChiefDecision, AgentRecommendation } from "./types";
import { ALL_AGENTS } from "./specialists";
import { analyzePair, buildAnalysisSummary } from "@/lib/market/analysis";
import { getCandles, getAllQuotes } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzeMultiTimeframe } from "@/lib/multi-timeframe/engine";
import { computeNewsImpact } from "@/lib/news-impact/engine";
import { recordDecisionAudit } from "@/lib/audit/service";
import { startTimer, endTimer } from "@/lib/audit/latency";
import { analyzeSessions } from "@/lib/session-analysis/engine";
import { computeHeatmap } from "@/lib/heatmap/engine";
import { correlationMatrix } from "@/lib/market/analysis";
import { db } from "@/lib/db";
import { DEFAULT_INSTRUMENTS } from "@/lib/market/instruments";
import { getOrCompute } from "@/lib/cache";

export async function buildAgentContext(symbol: string): Promise<AgentContext> {
  const sym = symbol.toUpperCase();
  const { quotes } = await getAllQuotes();
  const quote = quotes.find((q) => q.symbol === sym);
  const inst = DEFAULT_INSTRUMENTS.find((i) => i.symbol === sym);

  // Use cached analysis
  const allAnalysis = await getOrCompute("analysis:full:all", 10000, async () => {
    const { quotes: qs, session } = await getAllQuotes();
    const results: any[] = [];
    for (const q of qs) {
      const { candles } = await getCandles(q.symbol, "h1", 150);
      if (candles.length < 50) continue;
      const { analyzeFromData } = await import("@/lib/market/analysis");
      const a = analyzeFromData(q.symbol, candles, q, session);
      if (a) {
        const { candles: _c, ...light } = a;
        results.push(light);
      }
    }
    return results;
  });

  const analysis = allAnalysis.find((a: any) => a.symbol === sym);

  // Per-symbol heavy analyses (only compute on demand)
  let smc: any = null;
  let mtf: any = null;
  try {
    const { candles } = await getCandles(sym, "h1", 120);
    if (candles.length >= 30) {
      smc = analyzeSmartMoney(sym, "h1", candles);
    }
    mtf = await getOrCompute(`mtf:${sym}`, 30000, () => analyzeMultiTimeframe(sym));
  } catch { /* skip */ }

  // Shared cached data
  const newsImpact = await getOrCompute("news:impact", 60000, () => computeNewsImpact());
  const sessionAnalysis = await getOrCompute("sessions", 60000, () => analyzeSessions());
  const heatmap = await getOrCompute("heatmap", 30000, () => computeHeatmap());

  // Active signals
  const activeSignals = await db.activeSignal.findMany({
    where: { status: { in: ["active", "tp1_hit", "tp2_hit"] } },
    take: 20,
  });

  return {
    symbol: sym,
    price: quote?.last || analysis?.price || 0,
    digits: inst?.digits || 5,
    analysis,
    smc,
    mtf,
    newsImpact,
    sessionAnalysis,
    heatmap,
    activeSignals: activeSignals as any,
  };
}

export async function runChiefDecision(symbol: string): Promise<ChiefDecision> {
  const timerId = `chief:${symbol}:${Date.now()}`;
  startTimer(timerId, "processing", symbol);

  const ctx = await buildAgentContext(symbol);

  // Run all agents in parallel
  const reports: AgentReport[] = [];
  for (const agent of ALL_AGENTS) {
    try {
      const report = await agent.analyze(ctx);
      reports.push(report);
    } catch (e) {
      // skip failed agent
    }
  }

  // Compute weighted consensus
  let weightedScore = 0;
  let totalWeight = 0;
  let bullCount = 0;
  let bearCount = 0;
  let neutralCount = 0;

  for (const r of reports) {
    weightedScore += r.score * r.weight;
    totalWeight += r.weight;
    if (r.recommendation === "BUY") bullCount++;
    else if (r.recommendation === "SELL") bearCount++;
    else neutralCount++;
  }

  const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const alignment = Math.round((Math.max(bullCount, bearCount) / reports.length) * 100);

  // Unified confidence: blend of agent agreement and score magnitude
  const agreement = alignment / 100;
  const scoreMagnitude = Math.min(100, Math.abs(avgScore));
  const unifiedConfidence = Math.round(scoreMagnitude * 0.5 + agreement * 50);

  // Final recommendation
  let finalRecommendation: AgentRecommendation;
  if (avgScore > 20 && bullCount >= bearCount) finalRecommendation = "BUY";
  else if (avgScore < -20 && bearCount >= bullCount) finalRecommendation = "SELL";
  else if (Math.abs(avgScore) < 10 || agreement < 0.5) finalRecommendation = "WAIT";
  else finalRecommendation = "HOLD";

  // Direction
  const direction: "long" | "short" = avgScore >= 0 ? "long" : "short";

  // Trade setup
  const a = ctx.analysis;
  const atr = a?.atr || ctx.price * 0.005;
  const digits = ctx.digits;
  const isLong = direction === "long";
  const entryPrice = ctx.price;
  const slDist = atr * 1.5;
  const stopLoss = isLong ? entryPrice - slDist : entryPrice + slDist;
  const takeProfit1 = isLong ? entryPrice + atr * 1.5 : entryPrice - atr * 1.5;
  const takeProfit2 = isLong ? entryPrice + atr * 3 : entryPrice - atr * 3;
  const takeProfit3 = isLong ? entryPrice + atr * 5 : entryPrice - atr * 5;
  const riskReward = 5 / 1.5; // TP3 / SL = ~3.3

  // Risk level
  const riskScore = a?.riskScore || 50;
  const riskLevel: "low" | "medium" | "high" | "extreme" =
    riskScore >= 75 ? "extreme" : riskScore >= 55 ? "high" : riskScore >= 35 ? "medium" : "low";

  // Quality score
  const qualityScore = Math.round(
    unifiedConfidence * 0.4 +
    alignment * 0.3 +
    Math.min(100, riskReward * 15) * 0.1 +
    (100 - riskScore) * 0.2
  );

  // Build reasoning
  const reasoning = buildReasoning(reports, finalRecommendation, avgScore, alignment, ctx);

  const decision: ChiefDecision = {
    symbol: ctx.symbol,
    finalRecommendation,
    unifiedConfidence,
    qualityScore,
    direction,
    entryPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskReward: Math.round(riskReward * 10) / 10,
    riskLevel,
    reports,
    reasoning,
    consensus: { bullCount, bearCount, neutralCount, alignment },
    timestamp: Date.now(),
  };

  // Record audit trail (non-blocking, fire-and-forget)
  const processingLatency = endTimer(timerId);
  recordDecisionAudit({
    symbol: ctx.symbol,
    decision: finalRecommendation,
    confidence: unifiedConfidence,
    qualityScore,
    direction,
    reasoning,
    agentReports: reports.map(r => ({
      agent: r.agent,
      recommendation: r.recommendation,
      confidence: r.confidence,
      score: r.score,
      summary: r.summary,
      factors: r.factors,
    })),
    factorsSummary: {
      consensus: { bullCount, bearCount, neutralCount, alignment },
      avgScore,
      riskScore,
      riskReward,
    },
    dataSnapshot: {
      price: ctx.price,
      rsi: ctx.analysis?.rsi,
      adx: ctx.analysis?.adx,
      atr: ctx.analysis?.atr,
      macdHist: ctx.analysis?.macdHist,
      trend: ctx.analysis?.trend,
      signal: ctx.analysis?.signal,
      smcBias: ctx.smc?.summary?.bias,
      smcStructure: ctx.smc?.summary?.marketStructure,
      mtfAlignment: ctx.mtf?.overall?.alignment,
      premiumDiscount: ctx.smc?.premiumDiscount?.position,
    },
    newsSnapshot: ctx.newsImpact?.items?.slice(0, 5),
    sentimentSnapshot: ctx.heatmap ? {
      topCurrency: ctx.heatmap.topCurrency,
      bottomCurrency: ctx.heatmap.bottomCurrency,
    } : null,
    latency: {
      processingLatency: processingLatency || undefined,
    },
  }).catch(() => { /* non-fatal */ });

  return decision;
}

function buildReasoning(
  reports: AgentReport[],
  recommendation: AgentRecommendation,
  avgScore: number,
  alignment: number,
  ctx: AgentContext
): string {
  const lines: string[] = [];
  lines.push(`CHIEF AI AGENT DECISION: ${recommendation}`);
  lines.push(`Unified Confidence: ${Math.round(Math.abs(avgScore) * 0.5 + alignment * 0.5)}%`);
  lines.push(`Agent Consensus: ${reports.filter(r => r.recommendation === recommendation).length}/${reports.length} agents agree (${alignment}% alignment)`);
  lines.push(`Weighted Score: ${avgScore.toFixed(1)}/100`);
  lines.push("");
  lines.push("AGENT REPORTS:");

  for (const r of reports) {
    lines.push(`• ${r.name}: ${r.recommendation} (conf ${r.confidence}%, score ${r.score > 0 ? "+" : ""}${r.score.toFixed(0)})`);
    lines.push(`  ${r.summary}`);
    if (r.factors.length > 0) {
      const topFactors = r.factors.filter(f => f.impact !== "neutral").slice(0, 3);
      for (const f of topFactors) {
        lines.push(`  - ${f.name}: ${f.value} [${f.impact}]`);
      }
    }
  }

  lines.push("");
  lines.push(`FINAL DIRECTION: ${avgScore >= 0 ? "LONG" : "SHORT"}`);
  lines.push(`ENTRY: ${ctx.price.toFixed(ctx.digits)}`);
  lines.push(`The Chief AI Agent has aggregated ${reports.length} specialized agent reports and computed a unified confidence score based on weighted consensus. This decision is supported by technical analysis, smart money concepts, news impact, sentiment, risk management, execution conditions, and portfolio considerations.`);

  return lines.join("\n");
}

// ---------- Batch: run Chief Decision for all symbols ----------
export async function runChiefDecisionAll(): Promise<{
  decisions: ChiefDecision[];
  topPicks: ChiefDecision[];
}> {
  const { quotes } = await getAllQuotes();
  const decisions: ChiefDecision[] = [];

  for (const inst of DEFAULT_INSTRUMENTS) {
    if (!quotes.find((q) => q.symbol === inst.symbol)) continue;
    try {
      const decision = await runChiefDecision(inst.symbol);
      decisions.push(decision);
    } catch {
      // skip
    }
  }

  // Sort by quality score
  decisions.sort((a, b) => b.qualityScore - a.qualityScore);

  // Top picks: quality >= 50 and not WAIT
  const topPicks = decisions.filter((d) => d.qualityScore >= 50 && d.finalRecommendation !== "WAIT").slice(0, 5);

  return { decisions, topPicks };
}
