import { NextResponse } from "next/server";
import { getCandles } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { getOrCompute } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const { searchParams } = new URL(request.url);
  const tf = searchParams.get("tf") || "h1";
  const sym = symbol.toUpperCase();

  const analysis = await getOrCompute(
    `smc:${sym}:${tf}`,
    15000,
    async () => {
      const { candles } = await getCandles(sym, tf, 150);
      if (candles.length < 30) return null;
      return analyzeSmartMoney(sym, tf, candles);
    }
  );

  if (!analysis) {
    return NextResponse.json({ error: "Insufficient data" }, { status: 400 });
  }

  return NextResponse.json({ analysis, time: Date.now() });
}
