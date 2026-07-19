"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Loader2, TrendingDown, TrendingUp, Trash2, X } from "lucide-react";
import type { Position } from "@/lib/types";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";
import { formatPrice, formatNumber, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface PositionsPanelProps {
  onRefresh?: () => void;
}

function digitsFor(symbol: string): number {
  return INSTRUMENT_MAP[symbol]?.digits ?? 5;
}

export function PositionsPanel({ onRefresh }: PositionsPanelProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/positions", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPositions(data.positions ?? []);
    } catch {
      // silent fail on background refresh; surface only on first load
      if (loading) toast.error("Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchPositions();
    const id = setInterval(fetchPositions, 15000);
    return () => clearInterval(id);
  }, [fetchPositions]);

  const { openPositions, closedPositions, floatingPnl, realizedPnl } = useMemo(() => {
    const open = positions.filter((p) => p.status === "open");
    const closed = positions.filter((p) => p.status === "closed");
    const floating = open.reduce((acc, p) => acc + (p.pnl ?? 0), 0);
    const realized = closed.reduce((acc, p) => acc + (p.pnl ?? 0), 0);
    return {
      openPositions: open,
      closedPositions: closed,
      floatingPnl: floating,
      realizedPnl: realized,
    };
  }, [positions]);

  const handleClose = async (id: string, symbol: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/positions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Position closed: ${symbol}`);
      await fetchPositions();
      onRefresh?.();
    } catch {
      toast.error(`Failed to close ${symbol} position`);
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/positions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Position removed: ${symbol}`);
      await fetchPositions();
      onRefresh?.();
    } catch {
      toast.error(`Failed to delete ${symbol} position`);
    } finally {
      setActingId(null);
    }
  };

  const pnlColor = (v: number) => (v > 0 ? "tt-text-up" : v < 0 ? "tt-text-down" : "tt-text-dim");

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold">Positions</span>
          <span className="text-xs text-slate-500">· {openPositions.length} open</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Floating</span>
            <span className={`tt-mono text-[11px] ${pnlColor(floatingPnl)}`}>
              {floatingPnl >= 0 ? "+" : ""}{formatNumber(floatingPnl, 2)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Realized</span>
            <span className={`tt-mono text-[11px] ${pnlColor(realizedPnl)}`}>
              {realizedPnl >= 0 ? "+" : ""}{formatNumber(realizedPnl, 2)}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-white/5" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[220px]">
              No positions yet. Open one from the Analysis panel.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto tt-scroll">
            <table className="w-full text-xs ">
              <thead className="sticky top-0 bg-[#0a0d12]/95 backdrop-blur z-10">
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="text-left font-medium px-3 py-2">Symbol</th>
                  <th className="text-left font-medium px-2 py-2">Side</th>
                  <th className="text-right font-medium px-2 py-2">Size</th>
                  <th className="text-right font-medium px-2 py-2">Entry</th>
                  <th className="text-right font-medium px-2 py-2">Live / Exit</th>
                  <th className="text-right font-medium px-2 py-2">SL</th>
                  <th className="text-right font-medium px-2 py-2">TP</th>
                  <th className="text-right font-medium px-2 py-2">PnL $</th>
                  <th className="text-right font-medium px-2 py-2">Pips</th>
                  <th className="text-right font-medium px-2 py-2">Conf</th>
                  <th className="text-right font-medium px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((p) => {
                  const digits = digitsFor(p.symbol);
                  const pnl = p.pnl ?? 0;
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100">{p.symbol}</span>
                          <span className="text-[9px] text-slate-500">{relativeTime(p.openedAt)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            p.side === "long"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }`}
                        >
                          {p.side === "long" ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          {p.side}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tt-mono text-slate-300">{formatNumber(p.size, 2)}</td>
                      <td className="px-2 py-2 text-right tt-mono text-slate-300">{formatPrice(p.entryPrice, digits)}</td>
                      <td className="px-2 py-2 text-right tt-mono text-slate-200">
                        {p.livePrice != null ? formatPrice(p.livePrice, digits) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tt-mono tt-text-down">
                        {p.stopLoss != null ? formatPrice(p.stopLoss, digits) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tt-mono tt-text-up">
                        {p.takeProfit != null ? formatPrice(p.takeProfit, digits) : "—"}
                      </td>
                      <td className={`px-2 py-2 text-right tt-mono font-semibold ${pnlColor(pnl)}`}>
                        {pnl >= 0 ? "+" : ""}{formatNumber(pnl, 2)}
                      </td>
                      <td className={`px-2 py-2 text-right tt-mono ${pnlColor(pnl)}`}>
                        {p.pnlPips != null ? `${p.pnlPips >= 0 ? "+" : ""}${formatNumber(p.pnlPips, 1)}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tt-mono text-slate-400">{p.confidence ?? 0}%</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actingId === p.id}
                          onClick={() => handleClose(p.id, p.symbol)}
                          className="h-7 px-2 text-[11px] gap-1 text-slate-300 hover:text-white hover:bg-red-500/15"
                        >
                          {actingId === p.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          Close
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {closedPositions.length > 0 && (
                  <>
                    <tr className="border-t border-white/10">
                      <td colSpan={11} className="px-3 py-1.5 bg-white/[0.02]">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
                          Closed · {closedPositions.length}
                        </span>
                      </td>
                    </tr>
                    {closedPositions.map((p) => {
                      const digits = digitsFor(p.symbol);
                      const pnl = p.pnl ?? 0;
                      return (
                        <tr
                          key={p.id}
                          className="border-t border-white/5 hover:bg-white/[0.02] transition-colors opacity-80"
                        >
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-300">{p.symbol}</span>
                              <span className="text-[9px] text-slate-500">
                                {p.closedAt ? `closed ${relativeTime(p.closedAt)}` : relativeTime(p.openedAt)}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                p.side === "long"
                                  ? "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400/80 border-red-500/20"
                              }`}
                            >
                              {p.side}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right tt-mono text-slate-400">{formatNumber(p.size, 2)}</td>
                          <td className="px-2 py-2 text-right tt-mono text-slate-400">{formatPrice(p.entryPrice, digits)}</td>
                          <td className="px-2 py-2 text-right tt-mono text-slate-400">
                            {p.exitPrice != null ? formatPrice(p.exitPrice, digits) : "—"}
                          </td>
                          <td className="px-2 py-2 text-right tt-mono text-slate-500">
                            {p.stopLoss != null ? formatPrice(p.stopLoss, digits) : "—"}
                          </td>
                          <td className="px-2 py-2 text-right tt-mono text-slate-500">
                            {p.takeProfit != null ? formatPrice(p.takeProfit, digits) : "—"}
                          </td>
                          <td className={`px-2 py-2 text-right tt-mono font-semibold ${pnlColor(pnl)}`}>
                            {pnl >= 0 ? "+" : ""}{formatNumber(pnl, 2)}
                          </td>
                          <td className={`px-2 py-2 text-right tt-mono ${pnlColor(pnl)}`}>
                            {p.pnlPips != null ? `${p.pnlPips >= 0 ? "+" : ""}${formatNumber(p.pnlPips, 1)}` : "—"}
                          </td>
                          <td className="px-2 py-2 text-right tt-mono text-slate-500">{p.confidence ?? 0}%</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actingId === p.id}
                              onClick={() => handleDelete(p.id, p.symbol)}
                              className="h-7 px-2 text-[11px] gap-1 text-slate-400 hover:text-red-300 hover:bg-red-500/15"
                            >
                              {actingId === p.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
