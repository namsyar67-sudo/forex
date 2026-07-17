import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const symbol = searchParams.get("symbol");

  const where: any = {};
  if (unreadOnly) where.read = false;
  if (symbol) where.symbol = symbol;

  const events = await db.tradeEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await db.tradeEvent.count({ where: { read: false } });

  return NextResponse.json({ events, unreadCount, time: Date.now() });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { type, symbol, title, message, reason, priority, signalId } = body;
  if (!title || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const event = await db.tradeEvent.create({
    data: {
      signalId: signalId || null,
      symbol: symbol || "",
      type: type || "system",
      title,
      message,
      reason: reason || "",
      priority: priority || "medium",
    },
  });
  return NextResponse.json({ event });
}
