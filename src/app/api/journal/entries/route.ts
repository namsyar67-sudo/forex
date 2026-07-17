import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const entries = await db.tradeJournalEntry.findMany({
    orderBy: { closedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ entries, time: Date.now() });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { symbol, side, entryPrice, exitPrice, size, pnl, pnlPips, confidence, rationale, openedAt, closedAt, holdingHours, rr, win, tags } = body;
  if (!symbol || entryPrice == null || exitPrice == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const entry = await db.tradeJournalEntry.create({
    data: {
      symbol,
      side,
      entryPrice: parseFloat(entryPrice),
      exitPrice: parseFloat(exitPrice),
      size: parseFloat(size || 0),
      pnl: parseFloat(pnl || 0),
      pnlPips: parseFloat(pnlPips || 0),
      confidence: parseFloat(confidence || 0),
      rationale: rationale || null,
      openedAt: openedAt ? new Date(openedAt) : new Date(),
      closedAt: closedAt ? new Date(closedAt) : new Date(),
      holdingHours: parseFloat(holdingHours || 0),
      rr: parseFloat(rr || 0),
      win: !!win,
      tags: tags || null,
    },
  });
  return NextResponse.json({ entry });
}
