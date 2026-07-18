/**
 * Decision Audit Service
 * Every recommendation is recorded with a full audit trail:
 * - Why was it issued? (reasoning + agent reports)
 * - What data was used? (price, indicators, news, calendar, sentiment)
 * - What news affected it? (influencing news, breaking news)
 * - What changed afterward? (outcome, post-decision events, confidence change)
 *
 * This enables post-hoc review and system improvement over time.
 */
import { db } from "@/lib/db";
import { startTimer, endTimer } from "./latency";
import type { ChiefDecision } from "@/lib/agents/types";
import type { NewsIntelligenceReport } from "@/lib/news-intelligence/agents";

export interface AuditCreateInput {
  signalId?: string;
  symbol: string;
  decision: string;
  confidence: number;
  qualityScore: number;
  direction: string;
  reasoning: string;
  agentReports: any[];
  factorsSummary: Record<string, any>;
  dataSnapshot: Record<string, any>;
  newsSnapshot?: any[];
  calendarSnapshot?: any[];
  sentimentSnapshot?: any;
  influencingNews?: any[];
  breakingNewsAtDecision?: any[];
  latency?: {
    newsArrivalLatency?: number;
    processingLatency?: number;
    reanalysisLatency?: number;
    notificationLatency?: number;
    totalLatency?: number;
  };
}

export async function recordDecisionAudit(input: AuditCreateInput): Promise<string> {
  try {
    const audit = await db.decisionAudit.create({
      data: {
        signalId: input.signalId || null,
        symbol: input.symbol,
        decision: input.decision,
        confidence: input.confidence,
        qualityScore: input.qualityScore,
        direction: input.direction,
        reasoning: input.reasoning,
        agentReports: JSON.stringify(input.agentReports),
        factorsSummary: JSON.stringify(input.factorsSummary),
        dataSnapshot: JSON.stringify(input.dataSnapshot),
        newsSnapshot: input.newsSnapshot ? JSON.stringify(input.newsSnapshot) : null,
        calendarSnapshot: input.calendarSnapshot ? JSON.stringify(input.calendarSnapshot) : null,
        sentimentSnapshot: input.sentimentSnapshot ? JSON.stringify(input.sentimentSnapshot) : null,
        influencingNews: input.influencingNews ? JSON.stringify(input.influencingNews) : null,
        breakingNewsAtDecision: input.breakingNewsAtDecision ? JSON.stringify(input.breakingNewsAtDecision) : null,
        newsArrivalLatency: input.latency?.newsArrivalLatency || null,
        processingLatency: input.latency?.processingLatency || null,
        reanalysisLatency: input.latency?.reanalysisLatency || null,
        notificationLatency: input.latency?.notificationLatency || null,
        totalLatency: input.latency?.totalLatency || null,
      },
    });
    return audit.id;
  } catch {
    return "";
  }
}

// ---------- Resolve audit: track what happened after the decision ----------
export interface AuditResolveInput {
  auditId: string;
  finalOutcome: "win" | "loss" | "expired" | "invalidated" | "still_active";
  outcomePrice?: number;
  outcomePnl?: number;
  outcomeReason?: string;
  postDecisionEvents?: any[];
  confidenceChange?: number;
}

export async function resolveDecisionAudit(input: AuditResolveInput): Promise<void> {
  try {
    await db.decisionAudit.update({
      where: { id: input.auditId },
      data: {
        outcomeTracked: true,
        finalOutcome: input.finalOutcome,
        outcomePrice: input.outcomePrice || null,
        outcomePnl: input.outcomePnl || null,
        outcomeReason: input.outcomeReason || null,
        postDecisionEvents: input.postDecisionEvents ? JSON.stringify(input.postDecisionEvents) : null,
        confidenceChange: input.confidenceChange || null,
        resolvedAt: new Date(),
      },
    });
  } catch {
    // non-fatal
  }
}

// ---------- Get audit with full detail ----------
export async function getAuditDetail(auditId: string) {
  const audit = await db.decisionAudit.findUnique({ where: { id: auditId } });
  if (!audit) return null;

  return {
    ...audit,
    agentReports: JSON.parse(audit.agentReports || "[]"),
    factorsSummary: JSON.parse(audit.factorsSummary || "{}"),
    dataSnapshot: JSON.parse(audit.dataSnapshot || "{}"),
    newsSnapshot: audit.newsSnapshot ? JSON.parse(audit.newsSnapshot) : null,
    calendarSnapshot: audit.calendarSnapshot ? JSON.parse(audit.calendarSnapshot) : null,
    sentimentSnapshot: audit.sentimentSnapshot ? JSON.parse(audit.sentimentSnapshot) : null,
    influencingNews: audit.influencingNews ? JSON.parse(audit.influencingNews) : null,
    breakingNewsAtDecision: audit.breakingNewsAtDecision ? JSON.parse(audit.breakingNewsAtDecision) : null,
    postDecisionEvents: audit.postDecisionEvents ? JSON.parse(audit.postDecisionEvents) : null,
  };
}

// ---------- List audits with filters ----------
export async function listAudits(opts: {
  symbol?: string;
  decision?: string;
  outcome?: string;
  limit?: number;
  unresolvedOnly?: boolean;
} = {}): Promise<any[]> {
  const where: any = {};
  if (opts.symbol) where.symbol = opts.symbol;
  if (opts.decision) where.decision = opts.decision;
  if (opts.outcome) where.finalOutcome = opts.outcome;
  if (opts.unresolvedOnly) where.outcomeTracked = false;

  const audits = await db.decisionAudit.findMany({
    where,
    orderBy: { decisionTime: "desc" },
    take: opts.limit || 50,
  });

  return audits.map(a => ({
    id: a.id,
    signalId: a.signalId,
    symbol: a.symbol,
    decision: a.decision,
    confidence: a.confidence,
    qualityScore: a.qualityScore,
    direction: a.direction,
    outcomeTracked: a.outcomeTracked,
    finalOutcome: a.finalOutcome,
    outcomePnl: a.outcomePnl,
    confidenceChange: a.confidenceChange,
    totalLatency: a.totalLatency,
    processingLatency: a.processingLatency,
    notificationLatency: a.notificationLatency,
    decisionTime: a.decisionTime,
    resolvedAt: a.resolvedAt,
    reasoningPreview: a.reasoning.substring(0, 150),
  }));
}

// ---------- Audit stats ----------
export async function getAuditStats(): Promise<{
  total: number;
  resolved: number;
  winRate: number;
  avgConfidence: number;
  avgLatency: number;
  byDecision: Record<string, number>;
  byOutcome: Record<string, number>;
  recentTrend: { date: string; count: number; winRate: number }[];
}> {
  const total = await db.decisionAudit.count();
  const resolved = await db.decisionAudit.count({ where: { outcomeTracked: true } });
  const wins = await db.decisionAudit.count({ where: { finalOutcome: "win" } });
  const winRate = resolved > 0 ? Math.round((wins / resolved) * 100) : 0;

  const avgConfidenceResult = await db.decisionAudit.aggregate({ _avg: { confidence: true } });
  const avgLatencyResult = await db.decisionAudit.aggregate({ _avg: { totalLatency: true } });

  // By decision
  const byDecisionRows = await db.decisionAudit.groupBy({ by: ["decision"], _count: true });
  const byDecision: Record<string, number> = {};
  for (const r of byDecisionRows) byDecision[r.decision] = r._count;

  // By outcome
  const byOutcomeRows = await db.decisionAudit.groupBy({ by: ["finalOutcome"], _count: true });
  const byOutcome: Record<string, number> = {};
  for (const r of byOutcomeRows) byOutcome[r.finalOutcome || "unresolved"] = r._count;

  // Recent trend (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await db.decisionAudit.findMany({
    where: { decisionTime: { gt: sevenDaysAgo } },
    orderBy: { decisionTime: "asc" },
  });
  const trendMap: Record<string, { count: number; wins: number }> = {};
  for (const a of recent) {
    const date = a.decisionTime.toISOString().split("T")[0];
    if (!trendMap[date]) trendMap[date] = { count: 0, wins: 0 };
    trendMap[date].count++;
    if (a.finalOutcome === "win") trendMap[date].wins++;
  }
  const recentTrend = Object.entries(trendMap).map(([date, v]) => ({
    date,
    count: v.count,
    winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0,
  }));

  return {
    total,
    resolved,
    winRate,
    avgConfidence: Math.round((avgConfidenceResult._avg.confidence || 0) * 10) / 10,
    avgLatency: Math.round(avgLatencyResult._avg.totalLatency || 0),
    byDecision,
    byOutcome,
    recentTrend,
  };
}

// ---------- Auto-resolve: check unresolved audits and update outcomes ----------
export async function autoResolveAudits(): Promise<number> {
  const unresolved = await db.decisionAudit.findMany({
    where: {
      outcomeTracked: false,
      decisionTime: { lt: new Date(Date.now() - 30 * 60 * 1000) }, // at least 30 min old
    },
    take: 20,
  });

  let resolvedCount = 0;
  for (const audit of unresolved) {
    // If linked to a signal, check signal outcome
    if (audit.signalId) {
      const signal = await db.activeSignal.findUnique({ where: { id: audit.signalId } });
      if (signal && signal.status !== "active" && signal.status !== "tp1_hit" && signal.status !== "tp2_hit") {
        const outcome = signal.status === "closed_win" ? "win" : signal.status === "closed_loss" ? "loss" : "invalidated";
        await resolveDecisionAudit({
          auditId: audit.id,
          finalOutcome: outcome as any,
          outcomePrice: signal.currentPrice,
          outcomePnl: signal.closePnl || 0,
          outcomeReason: signal.closeReason || "",
          confidenceChange: signal.confidence - audit.confidence,
        });
        resolvedCount++;
        continue;
      }
    }

    // If no signal or still active, check if 2+ hours old → mark as expired
    const ageHours = (Date.now() - audit.decisionTime.getTime()) / (60 * 60 * 1000);
    if (ageHours > 2) {
      await resolveDecisionAudit({
        auditId: audit.id,
        finalOutcome: "expired",
        outcomeReason: "Decision expired without signal creation or resolution",
      });
      resolvedCount++;
    }
  }

  return resolvedCount;
}
