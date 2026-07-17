import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const signal = await db.activeSignal.findUnique({ where: { id } });
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }
  const events = await db.tradeEvent.findMany({
    where: { signalId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    signal: {
      ...signal,
      reasons: JSON.parse(signal.reasons || "[]"),
      indicators: JSON.parse(signal.indicators || "{}"),
    },
    events,
    time: Date.now(),
  });
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

  const signal = await db.activeSignal.findUnique({ where: { id } });
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  // Close signal manually
  if (body.action === "close") {
    const closeReason = body.reason || "Closed manually";
    const pnlPct = signal.direction === "long"
      ? ((signal.currentPrice - signal.entryPrice) / signal.entryPrice) * 100
      : ((signal.entryPrice - signal.currentPrice) / signal.entryPrice) * 100;
    const updated = await db.activeSignal.update({
      where: { id },
      data: {
        status: pnlPct >= 0 ? "closed_win" : "closed_loss",
        closedAt: new Date(),
        closeReason,
        closePnl: Math.round(pnlPct * 100) / 100,
      },
    });
    await db.tradeEvent.create({
      data: {
        signalId: id,
        symbol: signal.symbol,
        type: "CLOSE_POSITION",
        title: `🚫 Trade Closed Manually — ${signal.symbol}`,
        message: `Closed at ${signal.currentPrice}. PnL: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`,
        reason: closeReason,
        confidence: signal.confidence,
        priority: "high",
      },
    });
    await db.signalHistory.create({
      data: {
        symbol: signal.symbol,
        direction: signal.direction,
        signalType: signal.signalType,
        entryPrice: signal.entryPrice,
        confidence: signal.confidence,
        qualityScore: signal.qualityScore,
        reasons: signal.reasons,
        summary: signal.summary,
        outcome: pnlPct >= 0 ? "win" : "loss",
        closePrice: signal.currentPrice,
        pnlPct,
      },
    });
    return NextResponse.json({ signal: updated });
  }

  // Update SL/TP
  const updated = await db.activeSignal.update({
    where: { id },
    data: {
      stopLoss: body.stopLoss !== undefined ? parseFloat(body.stopLoss) : signal.stopLoss,
      takeProfit1: body.takeProfit1 !== undefined ? parseFloat(body.takeProfit1) : signal.takeProfit1,
      takeProfit2: body.takeProfit2 !== undefined ? parseFloat(body.takeProfit2) : signal.takeProfit2,
      takeProfit3: body.takeProfit3 !== undefined ? parseFloat(body.takeProfit3) : signal.takeProfit3,
    },
  });
  return NextResponse.json({ signal: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.activeSignal.update({
    where: { id },
    data: {
      status: "invalidated",
      closedAt: new Date(),
      closeReason: "Invalidated",
    },
  });
  return NextResponse.json({ success: true });
}
