import { NextResponse } from "next/server";
import { getCandles } from "@/lib/market/client";
import { analyzePriceAction } from "@/lib/price-action/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const { searchParams } = new URL(request.url);
  const tf = searchParams.get("tf") || "h1";
  const { candles } = await getCandles(symbol.toUpperCase(), tf, 200);
  if (candles.length < 10) {
    return NextResponse.json({ error: "Insufficient data" }, { status: 400 });
  }
  const analysis = analyzePriceAction(symbol.toUpperCase(), tf, candles);
  return NextResponse.json({ analysis, time: Date.now() });
}
