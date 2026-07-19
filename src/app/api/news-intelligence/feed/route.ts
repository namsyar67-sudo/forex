import { NextResponse } from "next/server";
import { runNewsIntelligence, shouldWaitForNews } from "@/lib/news-intelligence/orchestrator";
import { getOrCompute } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

// Lightweight fallback report when AI agents fail or timeout
function fallbackReport() {
  return {
    collectedCount: 0,
    verifiedCount: 0,
    verificationRate: 0,
    breakingCount: 0,
    sourceCount: 22,
    sentiment: { direction: "neutral", confidence: 0, currencies: [], reasoning: "News intelligence unavailable" },
    marketImpact: { symbols: [], overallImpact: "low", affectedCategories: [], expectedDuration: "hours", confidence: 0 },
    tradeImpact: { affectedTrades: [], hasCriticalImpact: false },
    aiSummary: {
      headline: "News Intelligence Unavailable",
      plainLanguageSummary: "The news intelligence system is currently unavailable. This may be due to high server load or API timeout. Please try again in a moment.",
      keyTakeaways: [],
      marketImplications: "Unable to analyze news impact at this time.",
      actionRequired: false,
    },
    scheduledAlerts: [],
    verifiedItems: [],
    breakingNews: [],
  };
}

// GET: fetch cached news intelligence (fast — returns cache or fallback)
export async function GET() {
  try {
    // Try to get cached report first (instant)
    const cached = getOrCompute("news:intelligence:light", 60000, async () => {
      try {
        const report = await runNewsIntelligence();
        return report;
      } catch {
        return null;
      }
    });

    if (!cached) {
      return NextResponse.json({
        report: fallbackReport(),
        decisionRule: { shouldWait: true, reason: "News intelligence unavailable — try again later" },
        timestamp: Date.now(),
      });
    }

    const waitCheck = shouldWaitForNews(cached);

    return NextResponse.json({
      report: {
        collectedCount: cached.collectedItems.length,
        verifiedCount: cached.verifiedItems.filter(i => i.isVerified).length,
        verificationRate: cached.verificationRate,
        breakingCount: cached.breakingNews.length,
        sourceCount: cached.sourceCount,
        sentiment: cached.sentiment,
        marketImpact: cached.marketImpact,
        tradeImpact: cached.tradeImpact,
        aiSummary: cached.aiSummary,
        scheduledAlerts: cached.scheduledAlerts,
        verifiedItems: cached.verifiedItems.slice(0, 10).map(i => ({
          title: i.title,
          summary: i.summary,
          source: i.sourceName,
          verificationScore: i.verificationScore,
          crossSourceCount: i.crossSourceCount,
          isVerified: i.isVerified,
          relatedSources: i.relatedItems.map(r => r.sourceName),
          symbols: i.symbols,
          publishedAt: i.publishedAt,
        })),
        breakingNews: cached.breakingNews.map(n => ({
          title: n.title,
          source: n.sourceName,
          verificationScore: n.verificationScore,
          symbols: n.symbols,
          publishedAt: n.publishedAt,
        })),
      },
      decisionRule: waitCheck,
      timestamp: cached.timestamp,
    });
  } catch (e: any) {
    return NextResponse.json({
      report: fallbackReport(),
      decisionRule: { shouldWait: true, reason: `Error: ${e.message}` },
      timestamp: Date.now(),
    });
  }
}

// POST: trigger full news intelligence (slow — runs all 8 agents)
export async function POST() {
  try {
    const report = await runNewsIntelligence();
    const waitCheck = shouldWaitForNews(report);

    return NextResponse.json({
      report: {
        collectedCount: report.collectedItems.length,
        verifiedCount: report.verifiedItems.filter(i => i.isVerified).length,
        verificationRate: report.verificationRate,
        breakingCount: report.breakingNews.length,
        sourceCount: report.sourceCount,
        sentiment: report.sentiment,
        marketImpact: report.marketImpact,
        tradeImpact: report.tradeImpact,
        aiSummary: report.aiSummary,
        scheduledAlerts: report.scheduledAlerts,
        verifiedItems: report.verifiedItems.slice(0, 10).map(i => ({
          title: i.title,
          summary: i.summary,
          source: i.sourceName,
          verificationScore: i.verificationScore,
          crossSourceCount: i.crossSourceCount,
          isVerified: i.isVerified,
          relatedSources: i.relatedItems.map(r => r.sourceName),
          symbols: i.symbols,
          publishedAt: i.publishedAt,
        })),
        breakingNews: report.breakingNews.map(n => ({
          title: n.title,
          source: n.sourceName,
          verificationScore: n.verificationScore,
          symbols: n.symbols,
          publishedAt: n.publishedAt,
        })),
      },
      decisionRule: waitCheck,
      timestamp: report.timestamp,
    });
  } catch (e: any) {
    return NextResponse.json({
      report: fallbackReport(),
      decisionRule: { shouldWait: true, reason: `Error: ${e.message}` },
      timestamp: Date.now(),
    });
  }
}
