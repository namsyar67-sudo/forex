import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllQuotes } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const positions = await db.position.findMany({
    orderBy: { openedAt: "desc" },
  });

  // Live PnL for open positions
  const { quotes } = await getAllQuotes();
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
  const enriched = positions.map((p) => {
    if (p.status === "open") {
      const q = quoteMap.get(p.symbol);
      if (q) {
        const livePrice = p.side === "long" ? q.bid : q.ask;
        const pnlPerUnit = p.side === "long" ? livePrice - p.entryPrice : p.entryPrice - livePrice;
        const pnl = pnlPerUnit * p.size * 1; // simplified
        const pnlPips = pnlPerUnit / 0.0001;
        return { ...p, livePrice, pnl: Math.round(pnl * 100) / 100, pnlPips: Math.round(pnlPips * 10) / 10 };
      }
    }
    return p;
  });

  return NextResponse.json({ positions: enriched, time: Date.now() });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { symbol, side, entryPrice, size, stopLoss, takeProfit, confidence, rationale } = body;
  if (!symbol || !side || !entryPrice || !size) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const pair = await db.pair.findUnique({ where: { symbol } });
  if (!pair) {
    return NextResponse.json({ error: "Pair not found" }, { status: 404 });
  }
  const position = await db.position.create({
    data: {
      pairId: pair.id,
      symbol,
      side,
      entryPrice: parseFloat(entryPrice),
      size: parseFloat(size),
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      confidence: confidence ? parseFloat(confidence) : 0,
      rationale: rationale || null,
    },
  });

  // Create alert
  await db.alert.create({
    data: {
      type: "trade",
      symbol,
      severity: "info",
      title: `Position opened: ${side.toUpperCase()} ${size} ${symbol}`,
      message: `Entry ${entryPrice}${stopLoss ? ` | SL ${stopLoss}` : ""}${takeProfit ? ` | TP ${takeProfit}` : ""}`,
    },
  });

  return NextResponse.json({ position, time: Date.now() });
}
