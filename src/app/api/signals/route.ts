import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllQuotes } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // active | closed | all
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const where = status && status !== "all" ? { status } : {};
  const signals = await db.activeSignal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Enrich active signals with live current price
  const { quotes } = await getAllQuotes();
  const enriched = signals.map((s) => {
    const q = quotes[s.symbol];
    if (q && (s.status === "active" || s.status === "tp1_hit" || s.status === "tp2_hit")) {
      const isLong = s.direction === "long";
      const livePnl = isLong
        ? ((q.last - s.entryPrice) / s.entryPrice) * 100
        : ((s.entryPrice - q.last) / s.entryPrice) * 100;
      const distToTP1 = isLong
        ? ((s.takeProfit1 - q.last) / q.last) * 100
        : ((q.last - s.takeProfit1) / q.last) * 100;
      const distToSL = isLong
        ? ((q.last - s.stopLoss) / q.last) * 100
        : ((s.stopLoss - q.last) / q.last) * 100;
      return {
        ...s,
        currentPrice: q.last,
        livePnl: Math.round(livePnl * 100) / 100,
        distToTP1: Math.round(distToTP1 * 100) / 100,
        distToSL: Math.round(distToSL * 100) / 100,
        reasons: JSON.parse(s.reasons || "[]"),
        indicators: JSON.parse(s.indicators || "{}"),
      };
    }
    return {
      ...s,
      reasons: JSON.parse(s.reasons || "[]"),
      indicators: JSON.parse(s.indicators || "{}"),
    };
  });

  return NextResponse.json({ signals: enriched, time: Date.now() });
}
