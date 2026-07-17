import { NextResponse } from "next/server";
import { analyzePair } from "@/lib/market/analysis";
import { getCandles } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzeMultiTimeframe } from "@/lib/multi-timeframe/engine";
import { computeProbabilities } from "@/lib/probability/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  const analysis = await analyzePair(sym);
  if (!analysis) {
    return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
  }
  const { candles } = await getCandles(sym, "h1", 300);
  const smc = candles.length >= 30 ? analyzeSmartMoney(sym, "h1", candles) : undefined;
  const mtf = await analyzeMultiTimeframe(sym);
  const prob = computeProbabilities(sym, analysis, smc, mtf);
  return NextResponse.json({ probability: prob, time: Date.now() });
}
