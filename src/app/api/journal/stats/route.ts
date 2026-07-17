import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const entries = await db.tradeJournalEntry.findMany({
    orderBy: { closedAt: "desc" },
    take: 200,
  });

  const total = entries.length;
  const wins = entries.filter((e) => e.win);
  const losses = entries.filter((e) => !e.win);
  const winRate = total > 0 ? Math.round((wins.length / total) * 100) : 0;
  const grossProfit = wins.reduce((a, e) => a + e.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, e) => a + e.pnl, 0));
  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
  const avgRR =
    total > 0 ? entries.reduce((a, e) => a + e.rr, 0) / total : 0;
  const avgHoldingHours =
    total > 0 ? entries.reduce((a, e) => a + e.holdingHours, 0) / total : 0;

  // Drawdown (peak-to-trough on cumulative pnl)
  let peak = 0;
  let cum = 0;
  let maxDD = 0;
  const chronological = [...entries].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
  );
  for (const e of chronological) {
    cum += e.pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }

  // Per-symbol breakdown
  const bySymbol: Record<string, { count: number; wins: number; pnl: number }> = {};
  for (const e of entries) {
    if (!bySymbol[e.symbol]) bySymbol[e.symbol] = { count: 0, wins: 0, pnl: 0 };
    bySymbol[e.symbol].count++;
    if (e.win) bySymbol[e.symbol].wins++;
    bySymbol[e.symbol].pnl += e.pnl;
  }
  const symbolStats = Object.entries(bySymbol)
    .map(([symbol, s]) => ({
      symbol,
      count: s.count,
      winRate: Math.round((s.wins / s.count) * 100),
      pnl: Math.round(s.pnl * 100) / 100,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  return NextResponse.json({
    stats: {
      total,
      wins: wins.length,
      losses: losses.length,
      winRate,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgRR: Math.round(avgRR * 100) / 100,
      avgHoldingHours: Math.round(avgHoldingHours * 10) / 10,
      maxDrawdown: Math.round(maxDD * 100) / 100,
      accuracy: winRate,
    },
    bySymbol: symbolStats,
    recent: entries.slice(0, 20),
    time: Date.now(),
  });
}
