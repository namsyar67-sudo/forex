import { NextResponse } from "next/server";
import { analyzeAll } from "@/lib/market/analysis";
import { generateMarketBriefing } from "@/lib/ai/ai-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const all = await analyzeAll();
  const briefing = await generateMarketBriefing(all);
  return NextResponse.json({ briefing, time: Date.now() });
}
