import { NextResponse } from "next/server";
import { NEWS_SOURCES } from "@/lib/news-intelligence/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    sources: NEWS_SOURCES,
    totalCount: NEWS_SOURCES.length,
    enabledCount: NEWS_SOURCES.filter(s => s.enabled).length,
    byCategory: {
      wire: NEWS_SOURCES.filter(s => s.category === "wire").length,
      financial: NEWS_SOURCES.filter(s => s.category === "financial").length,
      forex: NEWS_SOURCES.filter(s => s.category === "forex").length,
      crypto: NEWS_SOURCES.filter(s => s.category === "crypto").length,
      general: NEWS_SOURCES.filter(s => s.category === "general").length,
    },
  });
}
