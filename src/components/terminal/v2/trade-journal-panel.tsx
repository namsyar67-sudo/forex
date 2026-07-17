"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react";
import { formatNumber, formatPrice, relativeTime } from "@/lib/format";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface JournalStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  profitFactor: number;
  avgRR: number;
  avgHoldingHours: number;
  maxDrawdown: number;
  accuracy: number;
}

interface SymbolStat {
  symbol: string;
  count: number;
  winRate: number;
  pnl: number;
}

interface TradeJournalEntry {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPips: number;
  confidence: number;
  rationale: string | null;
  openedAt: string;
  closedAt: string;
  holdingHours: number;
  rr: number;
  win: boolean;
  tags: string | null;
  createdAt: string;
}

interface JournalResponse {
  stats: JournalStats;
  bySymbol: SymbolStat[];
  recent: TradeJournalEntry[];
  time?: number;
}

function digitsFor(symbol: string): number {
  return INSTRUMENT_MAP[symbol]?.digits ?? 5;
}

function pnlColor(v: number): string {
  if (v > 0) return "tt-text-up";
  if (v < 0) return "tt-text-down";
  return "tt-text-dim";
}

function signedNumber(v: number, decimals = 2): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${formatNumber(v, decimals)}`;
}

export function TradeJournalPanel() {
  const [data, setData] = useState<JournalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/journal/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as JournalResponse;
      setData(json);
    } catch {
      if (!silent) toast.error("Failed to load trade journal");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const stats = data?.stats;
  const bySymbol = data?.bySymbol ?? [];
  const recent = useMemo(
    () => (data?.recent ?? []).slice(0, 10),
    [data?.recent]
  );

  const hasTrades = (stats?.total ?? 0) > 0;

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold">Trade Journal</span>
          <span className="text-xs text-slate-500 truncate">
            · {stats?.total ?? 0} trades
          </span>
        </div>
        <button
          onClick={() => fetchData(false)}
          disabled={refreshing}
          className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full bg-white/5" />
              ))}
            </div>
            <Skeleton className="h-24 w-full bg-white/5" />
            <Skeleton className="h-32 w-full bg-white/5" />
          </div>
        ) : !hasTrades ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Trophy className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
              No closed trades yet. Close a position to populate the journal.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatCell
                label="Net Profit"
                value={signedNumber(stats?.netProfit ?? 0)}
                valueClass={pnlColor(stats?.netProfit ?? 0)}
                emphasize
              />
              <StatCell
                label="Win Rate"
                value={`${stats?.winRate ?? 0}%`}
                valueClass={
                  (stats?.winRate ?? 0) >= 50 ? "tt-text-up" : "tt-text-down"
                }
                emphasize
              />
              <StatCell
                label="Profit Factor"
                value={formatNumber(stats?.profitFactor ?? 0, 2)}
                valueClass={
                  (stats?.profitFactor ?? 0) >= 1
                    ? "tt-text-up"
                    : "tt-text-down"
                }
              />
              <StatCell
                label="Avg RR"
                value={`${formatNumber(stats?.avgRR ?? 0, 2)}R`}
                valueClass={
                  (stats?.avgRR ?? 0) >= 1 ? "tt-text-up" : "tt-text-dim"
                }
              />
              <StatCell
                label="Avg Holding"
                value={`${formatNumber(stats?.avgHoldingHours ?? 0, 1)}h`}
              />
              <StatCell
                label="Max Drawdown"
                value={`-${formatNumber(stats?.maxDrawdown ?? 0, 2)}`}
                valueClass="tt-text-down"
              />
              <StatCell
                label="Total Trades"
                value={`${stats?.total ?? 0}`}
              />
              <StatCell
                label="Wins / Losses"
                value={`${stats?.wins ?? 0} / ${stats?.losses ?? 0}`}
                valueClass="tt-text-dim"
              />
            </div>

            {/* Per-symbol breakdown */}
            {bySymbol.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                  Per Symbol
                </div>
                <div className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2.5 py-1.5 text-[9px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                    <span>Symbol</span>
                    <span className="text-right">Trades</span>
                    <span className="text-right">Win%</span>
                    <span className="text-right">PnL</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto tt-scroll">
                    {bySymbol.map((s) => (
                      <div
                        key={s.symbol}
                        className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2.5 py-1.5 text-[11px] border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]"
                      >
                        <span className="font-semibold text-slate-200 truncate">
                          {s.symbol}
                        </span>
                        <span className="text-right tt-mono text-slate-400">
                          {s.count}
                        </span>
                        <span
                          className={`text-right tt-mono ${
                            s.winRate >= 50 ? "tt-text-up" : "tt-text-down"
                          }`}
                        >
                          {s.winRate}%
                        </span>
                        <span
                          className={`text-right tt-mono font-semibold ${pnlColor(
                            s.pnl
                          )}`}
                        >
                          {signedNumber(s.pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recent trades */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                Recent Trades
              </div>
              <div className="space-y-1.5">
                {recent.map((t) => {
                  const digits = digitsFor(t.symbol);
                  const win = t.win;
                  const SideIcon =
                    t.side === "long" ? TrendingUp : TrendingDown;
                  return (
                    <div
                      key={t.id}
                      className="rounded-lg border border-white/5 bg-black/20 p-2.5 hover:bg-black/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-slate-100">
                          {t.symbol}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            t.side === "long"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }`}
                        >
                          <SideIcon className="w-2.5 h-2.5" />
                          {t.side}
                        </span>
                        <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {relativeTime(t.closedAt)}
                        </span>
                        {win ? (
                          <CheckCircle2 className="w-3.5 h-3.5 tt-text-up ml-auto" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 tt-text-down ml-auto" />
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-[10px]">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">
                            Entry → Exit
                          </div>
                          <div className="tt-mono text-slate-300 truncate">
                            {formatPrice(t.entryPrice, digits)} →{" "}
                            {formatPrice(t.exitPrice, digits)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">
                            PnL
                          </div>
                          <div
                            className={`tt-mono font-semibold ${pnlColor(t.pnl)}`}
                          >
                            {signedNumber(t.pnl)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">
                            RR
                          </div>
                          <div
                            className={`tt-mono ${
                              t.rr >= 1 ? "tt-text-up" : "tt-text-dim"
                            }`}
                          >
                            {formatNumber(t.rr, 2)}R
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">
                            Held
                          </div>
                          <div className="tt-mono text-slate-300">
                            {formatNumber(t.holdingHours, 1)}h
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  valueClass,
  emphasize,
}: {
  label: string;
  value: string;
  valueClass?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-white/5 bg-black/20 px-2.5 py-2 ${
        emphasize ? "ring-1 ring-white/5" : ""
      }`}
    >
      <div className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`tt-mono ${emphasize ? "text-base" : "text-sm"} font-semibold ${
          valueClass ?? "text-slate-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default TradeJournalPanel;
