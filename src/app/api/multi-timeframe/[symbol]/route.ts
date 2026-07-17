import { NextResponse } from "next/server";
import { analyzeMultiTimeframe } from "@/lib/multi-timeframe/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const analysis = await analyzeMultiTimeframe(symbol.toUpperCase());
  return NextResponse.json({ analysis, time: Date.now() });
}
