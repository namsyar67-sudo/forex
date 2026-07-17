import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const entries = await db.decisionTimelineEntry.findMany({
    where: { symbol: symbol.toUpperCase() },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  // Compute transitions
  const transitions: { from: string; to: string; count: number }[] = [];
  for (let i = 1; i < entries.length; i++) {
    const from = entries[i - 1].action;
    const to = entries[i].action;
    const existing = transitions.find((t) => t.from === from && t.to === to);
    if (existing) existing.count++;
    else transitions.push({ from, to, count: 1 });
  }

  return NextResponse.json({
    entries: entries.slice(-50).reverse(),
    transitions,
    total: entries.length,
    time: Date.now(),
  });
}
