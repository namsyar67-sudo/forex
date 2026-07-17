import { NextResponse } from "next/server";
import { analyzePair, buildAnalysisSummary } from "@/lib/market/analysis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const analysis = await analyzePair(symbol.toUpperCase());
  if (!analysis) {
    return NextResponse.json({ error: "Symbol not found or insufficient data" }, { status: 404 });
  }
  const summary = buildAnalysisSummary(analysis);
  // Strip candle array to keep payload light
  const { candles, ...lightAnalysis } = analysis;
  return NextResponse.json({ analysis: lightAnalysis, summary, time: Date.now() });
}
