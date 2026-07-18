import { NextResponse } from "next/server";
import { runNewsIntelligence, shouldWaitForNews } from "@/lib/news-intelligence/orchestrator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST: check for breaking news (faster endpoint, no caching)
export async function POST() {
  try {
    const report = await runNewsIntelligence();
    const waitCheck = shouldWaitForNews(report);

    return NextResponse.json({
      breakingNews: report.breakingNews.map(n => ({
        title: n.title,
        summary: n.summary,
        source: n.sourceName,
        verificationScore: n.verificationScore,
        crossSourceCount: n.crossSourceCount,
        symbols: n.symbols,
        publishedAt: n.publishedAt,
      })),
      breakingCount: report.breakingNews.length,
      shouldPause: report.breakingNews.length > 0,
      decisionRule: waitCheck,
      timestamp: report.timestamp,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
