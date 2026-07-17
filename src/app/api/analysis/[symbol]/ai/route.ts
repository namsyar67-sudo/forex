import { NextResponse } from "next/server";
import { analyzePair, buildAnalysisSummary } from "@/lib/market/analysis";
import { interpretAnalysis } from "@/lib/ai/ai-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const analysis = await analyzePair(symbol.toUpperCase());
  if (!analysis) {
    return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
  }
  const summary = buildAnalysisSummary(analysis);
  const interpretation = await interpretAnalysis(analysis, summary);
  return NextResponse.json({ analysis, summary, interpretation, time: Date.now() });
}
