import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const symbol = searchParams.get("symbol");

  const events = await db.tradeEvent.findMany({
    where: {
      ...(symbol ? { symbol } : {}),
      type: { in: ["HIGH_IMPACT_NEWS", "NEWS_CHANGED", "BREAKING_NEWS"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ events, count: events.length, time: Date.now() });
}
