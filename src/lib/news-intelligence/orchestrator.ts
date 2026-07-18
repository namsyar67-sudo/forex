/**
 * News Intelligence Orchestrator
 * Runs all 8 news agents in parallel and produces a unified report.
 *
 * CRITICAL PRINCIPLE:
 * No trading recommendation is issued based on a single news item or source.
 * If data conflicts or is incomplete, the recommendation MUST be "WAIT".
 */
import { db } from "@/lib/db";
import { generateCalendar } from "@/lib/market/news";
import {
  collectNews,
  verifyNews,
  detectBreakingNews,
  analyzeMarketImpact,
  analyzeNewsSentiment,
  analyzeTradeImpact,
  generateNewsAISummary,
  processCalendarEvents,
  generateScheduledAlerts,
  type NewsIntelligenceReport,
  type CollectedNewsItem,
  type VerifiedNewsItem,
} from "./agents";
import { getEnabledSources } from "./sources";
import { getOrCompute } from "@/lib/cache";

// ---------- Main orchestrator ----------
export async function runNewsIntelligence(): Promise<NewsIntelligenceReport> {
  // Step 1: Collect news (Agent 1)
  const collectedItems = await collectNews();

  // Step 2: Verify news (Agent 2) — deduplicate and cross-check sources
  const verifiedItems = verifyNews(collectedItems);

  // Step 3: Process economic calendar (Agent 3)
  const calendarEvents = await getOrCompute("calendar:events", 300000, async () => generateCalendar(2));
  const processedCalendar = processCalendarEvents(calendarEvents);

  // Step 4: Detect breaking news (Agent 4)
  const breakingNews = detectBreakingNews(verifiedItems);

  // Step 5-8: Run market impact, sentiment, trade impact, and AI summary in parallel
  const [marketImpact, sentiment] = await Promise.all([
    analyzeMarketImpact(verifiedItems),
    analyzeNewsSentiment(verifiedItems),
  ]);

  // Get active signals for trade impact
  const activeSignals = await db.activeSignal.findMany({
    where: { status: { in: ["active", "tp1_hit", "tp2_hit"] } },
    take: 20,
  });

  const tradeImpact = await analyzeTradeImpact(activeSignals as any[], marketImpact, breakingNews);
  const aiSummary = await generateNewsAISummary(verifiedItems, sentiment, marketImpact);

  // Generate scheduled alerts
  const scheduledAlerts = generateScheduledAlerts(processedCalendar);

  // Fire trade impact alerts
  if (tradeImpact.affectedTrades.length > 0) {
    for (const trade of tradeImpact.affectedTrades) {
      if (trade.impactLevel === "critical" || trade.impactLevel === "high") {
        const recent = await db.tradeEvent.findFirst({
          where: {
            signalId: trade.signalId,
            type: "HIGH_IMPACT_NEWS",
            createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
          },
        });
        if (!recent) {
          await db.tradeEvent.create({
            data: {
              signalId: trade.signalId,
              symbol: trade.symbol,
              type: "HIGH_IMPACT_NEWS",
              title: trade.impactLevel === "critical"
                ? `🚨 Breaking News Impact — ${trade.symbol}`
                : `📢 News Impact — ${trade.symbol}`,
              message: trade.reasoning,
              reason: `News impact ${trade.impactLevel} on ${trade.symbol} ${trade.direction} position. Recommendation: ${trade.recommendation.replace(/_/g, " ")}.`,
              confidence: trade.currentConfidence,
              priority: trade.impactLevel === "critical" ? "critical" : "high",
            },
          });
        }
      }
    }
  }

  // Fire scheduled calendar alerts
  for (const alert of scheduledAlerts) {
    if (alert.fired) continue;
    const eventTime = new Date(alert.eventTime).getTime();
    const fireTime = eventTime - alert.minutesBefore * 60 * 1000;
    if (Date.now() >= fireTime) {
      const recent = await db.tradeEvent.findFirst({
        where: {
          type: "NEWS_CHANGED",
          symbol: alert.affectedSymbols[0] || "",
          createdAt: { gt: new Date(fireTime - 60 * 1000) },
        },
      });
      if (!recent) {
        await db.tradeEvent.create({
          data: {
            symbol: alert.affectedSymbols[0] || "",
            type: "NEWS_CHANGED",
            title: `📅 Upcoming High Impact — ${alert.eventTitle} (${alert.minutesBefore}m)`,
            message: `${alert.eventTitle} in ${alert.minutesBefore} minute(s). Affected: ${alert.affectedSymbols.slice(0, 4).join(", ")}. Avoid opening new positions until release.`,
            reason: `High impact event approaching in ${alert.minutesBefore} minutes.`,
            priority: alert.minutesBefore <= 5 ? "critical" : "high",
          },
        });
      }
    }
  }

  // Compute verification rate
  const verificationRate = verifiedItems.length > 0
    ? Math.round((verifiedItems.filter(i => i.isVerified).length / verifiedItems.length) * 100)
    : 0;

  return {
    collectedItems,
    verifiedItems,
    sentiment,
    marketImpact,
    tradeImpact,
    aiSummary,
    breakingNews,
    scheduledAlerts,
    timestamp: Date.now(),
    sourceCount: getEnabledSources().length,
    verificationRate,
  };
}

// ---------- Decision rule: WAIT if data is incomplete or conflicting ----------
export function shouldWaitForNews(report: NewsIntelligenceReport): {
  shouldWait: boolean;
  reason: string;
} {
  // WAIT if no verified news
  const verifiedCount = report.verifiedItems.filter(i => i.isVerified).length;
  if (verifiedCount === 0) {
    return { shouldWait: true, reason: "No verified news available — cannot confirm market direction" };
  }

  // WAIT if verification rate is too low (< 30%)
  if (report.verificationRate < 30) {
    return { shouldWait: true, reason: `Low news verification rate (${report.verificationRate}%) — sources disagree` };
  }

  // WAIT if breaking news detected (market is unstable)
  if (report.breakingNews.length > 0) {
    return { shouldWait: true, reason: `${report.breakingNews.length} breaking news items detected — market unstable` };
  }

  // WAIT if high-impact calendar event within 5 minutes
  const imminentEvent = report.scheduledAlerts.find(a => a.minutesBefore <= 5 && !a.fired);
  if (imminentEvent) {
    return { shouldWait: true, reason: `High impact event (${imminentEvent.eventTitle}) in ${imminentEvent.minutesBefore}m` };
  }

  // WAIT if trade impact is critical
  if (report.tradeImpact?.hasCriticalImpact) {
    return { shouldWait: true, reason: "Critical news impact on open positions — reduce risk first" };
  }

  // WAIT if sentiment confidence is low
  if (report.sentiment && report.sentiment.confidence < 40) {
    return { shouldWait: true, reason: `Low sentiment confidence (${report.sentiment.confidence}%) — signals mixed` };
  }

  return { shouldWait: false, reason: "News conditions are clear" };
}
