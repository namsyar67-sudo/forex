import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllQuotes } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const position = await db.position.findUnique({ where: { id } });
  if (!position) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ position });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const position = await db.position.findUnique({ where: { id } });
  if (!position) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Close position
  if (body.action === "close") {
    let exitPrice = body.exitPrice ? parseFloat(body.exitPrice) : null;
    if (!exitPrice) {
      const { quotes } = await getAllQuotes();
      const q = quotes.find((x) => x.symbol === position.symbol);
      if (q) {
        exitPrice = position.side === "long" ? q.bid : q.ask;
      } else {
        exitPrice = position.entryPrice;
      }
    }
    const pnlPerUnit = position.side === "long" ? exitPrice - position.entryPrice : position.entryPrice - exitPrice;
    const pnl = Math.round(pnlPerUnit * position.size * 100) / 100;
    const pnlPips = Math.round(pnlPerUnit / 0.0001 * 10) / 10;
    const updated = await db.position.update({
      where: { id },
      data: { status: "closed", exitPrice, pnl, pnlPips, closedAt: new Date() },
    });
    await db.alert.create({
      data: {
        type: "trade",
        symbol: position.symbol,
        severity: pnl >= 0 ? "info" : "warning",
        title: `Position closed: ${position.symbol}`,
        message: `${position.side.toUpperCase()} ${position.size} ${position.symbol} closed at ${exitPrice}. PnL: ${pnl} (${pnlPips} pips)`,
      },
    });
    return NextResponse.json({ position: updated });
  }

  // Update SL/TP
  const updated = await db.position.update({
    where: { id },
    data: {
      stopLoss: body.stopLoss !== undefined ? (body.stopLoss ? parseFloat(body.stopLoss) : null) : position.stopLoss,
      takeProfit: body.takeProfit !== undefined ? (body.takeProfit ? parseFloat(body.takeProfit) : null) : position.takeProfit,
    },
  });
  return NextResponse.json({ position: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.position.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
