import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllQuotes } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const signals = await db.activeSignal.findMany({
    where: { status: { in: ["active", "tp1_hit", "tp2_hit"] } },
    orderBy: { qualityScore: "desc" },
  });

  const { quotes } = await getAllQuotes();
  const enriched = signals.map((s) => {
    const q = quotes[s.symbol];
    const isLong = s.direction === "long";
    const livePrice = q?.last || s.currentPrice;
    const livePnl = isLong
      ? ((livePrice - s.entryPrice) / s.entryPrice) * 100
      : ((s.entryPrice - livePrice) / s.entryPrice) * 100;
    return {
      ...s,
      currentPrice: livePrice,
      livePnl: Math.round(livePnl * 100) / 100,
      reasons: JSON.parse(s.reasons || "[]"),
      indicators: JSON.parse(s.indicators || "{}"),
    };
  });

  return NextResponse.json({ signals: enriched, count: enriched.length, time: Date.now() });
}
