import { NextResponse } from "next/server";
import { getCandles } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "EURUSD";
  const tf = searchParams.get("tf") || "h1";
  const count = parseInt(searchParams.get("count") || "200", 10);
  const { candles, quote } = await getCandles(symbol, tf, count);
  return NextResponse.json({ symbol, timeframe: tf, candles, quote });
}
