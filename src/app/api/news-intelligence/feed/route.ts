import { NextResponse } from "next/server";
import { runNewsIntelligence, shouldWaitForNews } from "@/lib/news-intelligence/orchestrator";
import { getOrCompute } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST: run full news intelligence pipeline
export async function POST() {
  try {
    const report = await getOrCompute("news:intelligence", 30000, () => runNewsIntelligence());
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: fetch cached news intelligence
export async function GET() {
  try {
    const report = await getOrCompute("news:intelligence", 30000, () => runNewsIntelligence());
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
