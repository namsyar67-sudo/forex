"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  Timer,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, relativeTime } from "@/lib/format";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";

type Direction = "long" | "short";
type SignalType = "STRONG_BUY" | "BUY" | "WAIT" | "SELL" | "STRONG_SELL";
type RiskLevel = "low" | "medium" | "high" | "extreme";

interface ActiveSignal {
  id: string;
  symbol: string;
  direction: Direction;
  signalType: SignalType;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  confidence: number;
  qualityScore: number;
  expectedDuration: string;
  expectedProbability: number;
  riskLevel: RiskLevel;
  marketSession: string;
  reasons: string[];
  summary: string;
  livePnl?: number;
  distToTP1?: number;
  distToSL?: number;
  indicators: Record<string, unknown>;
  status: string;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  createdAt: string;
  closedAt?: string | null;
  closeReason?: string | null;
  closePnl?: number | null;
}

interface ActiveResponse {
  signals: ActiveSignal[];
  count: number;
  time: number;
}

const REFRESH_INTERVAL = 5_000;

const DIRECTION_BADGE: Record<Direction, string> = {
  long: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  short: "bg-red-500/15 text-red-400 border-red-500/30",
};

const RISK_BADGE: Record<RiskLevel, string> = {
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  extreme: "bg-red-500/15 text-red-400 border-red-500/30",
};

function digitsFor(symbol: string): number {
  return INSTRUMENT_MAP[symbol]?.digits ?? 5;
}

function pnlColor(v: number): string {
  if (v > 0) return "tt-text-up";
  if (v < 0) return "tt-text-down";
  return "tt-text-dim";
}

function signedPct(v: number): string {
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "active":
      return { label: "ACTIVE", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    case "tp1_hit":
      return { label: "TP1 HIT", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    case "tp2_hit":
      return { label: "TP2 HIT", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    case "tp3_hit":
      return { label: "TP3 HIT", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    default:
      return { label: status.toUpperCase(), cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
  }
}

interface TradeMonitorPanelProps {
  onSelectSignal?: (signalId: string) => void;
}

export function TradeMonitorPanel({ onSelectSignal }: TradeMonitorPanelProps) {
  const [data, setData] = useState<ActiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/signals/active", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ActiveResponse;
      setData(json);
    } catch {
      if (!silent) toast.error("Failed to load trade monitor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const id = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleClose = useCallback(
    async (signal: ActiveSignal) => {
      setClosingId(signal.id);
      try {
        const res = await fetch(`/api/signals/${signal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "close", reason: "Closed manually" }),
        });
        if (!res.ok) throw new Error("Close failed");
        const pnl = signal.livePnl ?? 0;
        toast.success(
          `${signal.symbol} closed · ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`
        );
        await fetchData(true);
      } catch {
        toast.error(`Failed to close ${signal.symbol}`);
      } finally {
        setClosingId(null);
      }
    },
    [fetchData]
  );

  const signals = data?.signals ?? [];
  const count = data?.count ?? 0;

  const summary = useMemo(() => {
    const totalPnl = signals.reduce((s, x) => s + (x.livePnl ?? 0), 0);
    const sorted = [...signals].sort(
      (a, b) => (b.livePnl ?? -Infinity) - (a.livePnl ?? -Infinity)
    );
    const best = sorted[0] ?? null;
    const worst = sorted[sorted.length - 1] ?? null;
    return { total: signals.length, totalPnl, best, worst };
  }, [signals]);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">Trade Monitor</span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tt-mono">
            {count}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            LIVE
          </span>
        </div>
        <button
          onClick={() => fetchData(false)}
          disabled={refreshing}
          className="text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors shrink-0"
          aria-label="Refresh"
          title="Refresh"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Summary bar */}
      {!loading && signals.length > 0 && (
        <div className="grid grid-cols-4 gap-2 p-3 border-b border-white/5 bg-black/20">
          <SummaryCell
            label="Active"
            value={`${summary.total}`}
            valueClass="text-slate-200"
          />
          <SummaryCell
            label="Total PnL"
            value={signedPct(summary.totalPnl)}
            valueClass={pnlColor(summary.totalPnl)}
            emphasize
          />
          <SummaryCell
            label="Best"
            value={
              summary.best
                ? `${summary.best.symbol} ${signedPct(summary.best.livePnl ?? 0)}`
                : "—"
            }
            valueClass="tt-text-up"
            compact
          />
          <SummaryCell
            label="Worst"
            value={
              summary.worst
                ? `${summary.worst.symbol} ${signedPct(summary.worst.livePnl ?? 0)}`
                : "—"
            }
            valueClass="tt-text-down"
            compact
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading ? (
          <TradeMonitorSkeleton />
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed">
              No active trades being monitored. Signals will appear here when
              the scanner finds opportunities.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2.5">
            {signals.map((s) => (
              <TradeCard
                key={s.id}
                signal={s}
                onClose={() => handleClose(s)}
                closing={closingId === s.id}
                onSelect={onSelectSignal ? () => onSelectSignal(s.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeCard({
  signal,
  onClose,
  closing,
  onSelect,
}: {
  signal: ActiveSignal;
  onClose: () => void;
  closing: boolean;
  onSelect?: () => void;
}) {
  const digits = digitsFor(signal.symbol);
  const isLong = signal.direction === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const pnl = signal.livePnl ?? 0;
  const inProfit = pnl >= 0;
  const st = statusBadge(signal.status);

  const tpStatuses = [
    { label: "TP1", hit: signal.tp1Hit },
    { label: "TP2", hit: signal.tp2Hit },
    { label: "TP3", hit: signal.tp3Hit },
  ];

  return (
    <div className="rounded-lg border border-white/5 bg-black/20 hover:bg-black/30 transition-colors">
      {/* Top: symbol + badges + relative time */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 flex-wrap">
        <button
          type="button"
          onClick={onSelect}
          disabled={!onSelect}
          className={`text-sm font-bold ${onSelect ? "text-slate-100 hover:text-emerald-300" : "text-slate-100"} transition-colors`}
        >
          {signal.symbol}
        </button>
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${DIRECTION_BADGE[signal.direction]}`}
        >
          <DirectionIcon className="w-2.5 h-2.5" />
          {signal.direction}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${st.cls}`}
        >
          {st.label}
        </span>
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-slate-500">
          <Clock className="w-2.5 h-2.5" />
          {relativeTime(signal.createdAt)}
        </span>
      </div>

      {/* Live PnL + TP status indicators */}
      <div className="flex items-end justify-between px-3 pb-2">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            Live PnL
          </div>
          <div className={`tt-mono text-2xl font-bold leading-none ${pnlColor(pnl)}`}>
            {signedPct(pnl)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {tpStatuses.map((tp) => (
            <span
              key={tp.label}
              className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[10px] font-bold uppercase border ${
                tp.hit
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-white/5 text-slate-500 border-white/10"
              }`}
              title={tp.hit ? `${tp.label} hit` : `${tp.label} pending`}
            >
              {tp.hit ? (
                <Check className="w-2.5 h-2.5" />
              ) : (
                <span className="w-2.5 h-2.5 flex items-center justify-center text-[8px]">·</span>
              )}
              {tp.label}
            </span>
          ))}
        </div>
      </div>

      {/* Progress bar: Entry → TP3 with markers + current price dot */}
      <div className="px-3 pb-1">
        <PriceProgressBar signal={signal} digits={digits} inProfit={inProfit} />
      </div>

      {/* Distance to TP1 + SL */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-2 pb-2">
        <div className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            Dist to TP1
          </div>
          <div className="tt-mono text-[11px] font-semibold tt-text-up">
            {typeof signal.distToTP1 === "number"
              ? signedPct(signal.distToTP1)
              : "—"}
          </div>
        </div>
        <div className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            Dist to SL
          </div>
          <div className="tt-mono text-[11px] font-semibold tt-text-down">
            {typeof signal.distToSL === "number"
              ? signedPct(signal.distToSL)
              : "—"}
          </div>
        </div>
      </div>

      {/* Mini grid: Confidence, Quality, Risk Level, RR, Session */}
      <div className="grid grid-cols-5 gap-1.5 px-3 pb-2">
        <MiniStat label="Conf" value={`${signal.confidence.toFixed(0)}%`} />
        <MiniStat
          label="Quality"
          value={`${Math.round(signal.qualityScore)}`}
        />
        <MiniStat
          label="Risk"
          value={signal.riskLevel.toUpperCase()}
          badgeClass={RISK_BADGE[signal.riskLevel]}
        />
        <MiniStat
          label="RR"
          value={`1:${signal.riskReward.toFixed(1)}`}
          valueClass="tt-text-accent"
        />
        <MiniStat
          label="Session"
          value={signal.marketSession}
          compact
        />
      </div>

      {/* Footer: close button */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5">
        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
          <Timer className="w-2.5 h-2.5" />
          Opened {relativeTime(signal.createdAt)}
        </span>
        <button
          onClick={onClose}
          disabled={closing}
          className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
        >
          {closing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
          Close Trade
        </button>
      </div>
    </div>
  );
}

/**
 * Price progress bar spanning SL → TP3 with markers at Entry, TP1, TP2, TP3.
 * Filled portion goes from Entry to current price (emerald if profit, red if loss).
 * Current price shown as a pulsing dot.
 */
function PriceProgressBar({
  signal,
  digits,
  inProfit,
}: {
  signal: ActiveSignal;
  digits: number;
  inProfit: boolean;
}) {
  const { stopLoss, entryPrice, currentPrice, takeProfit1, takeProfit2, takeProfit3 } =
    signal;

  const markers = [stopLoss, entryPrice, takeProfit1, takeProfit2, takeProfit3];
  const min = Math.min(...markers);
  const max = Math.max(...markers);
  const range = max - min || 1;

  const pct = (v: number) => ((v - min) / range) * 100;
  const slPct = pct(stopLoss);
  const entryPct = pct(entryPrice);
  const tp1Pct = pct(takeProfit1);
  const tp2Pct = pct(takeProfit2);
  const tp3Pct = pct(takeProfit3);
  const curPct = Math.max(0, Math.min(100, pct(currentPrice)));

  const fillColor = inProfit ? "bg-emerald-500" : "bg-red-500";

  const tickMarkers = [
    { p: slPct, label: "SL", cls: "bg-red-400", textCls: "text-red-400" },
    { p: entryPct, label: "E", cls: "bg-white", textCls: "text-slate-300" },
    { p: tp1Pct, label: "1", cls: "bg-emerald-400", textCls: "text-emerald-400" },
    { p: tp2Pct, label: "2", cls: "bg-emerald-400", textCls: "text-emerald-400" },
    { p: tp3Pct, label: "3", cls: "bg-emerald-400", textCls: "text-emerald-400" },
  ];

  return (
    <div className="relative h-12 select-none">
      {/* Track */}
      <div className="absolute top-5 left-0 right-0 h-1.5 rounded-full bg-white/10" />

      {/* Filled portion (entry → current) */}
      <div
        className={`absolute top-5 h-1.5 rounded-full ${fillColor} ${
          inProfit ? "shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "shadow-[0_0_8px_rgba(239,68,68,0.4)]"
        }`}
        style={{
          left: `${Math.min(entryPct, curPct)}%`,
          width: `${Math.abs(curPct - entryPct)}%`,
        }}
      />

      {/* Tick marks */}
      {tickMarkers.map((m, i) => (
        <div
          key={i}
          className={`absolute top-[18px] w-0.5 h-3 -translate-x-1/2 ${m.cls}`}
          style={{ left: `${m.p}%` }}
        />
      ))}

      {/* Marker labels (below bar) */}
      {tickMarkers.map((m, i) => (
        <div
          key={`l-${i}`}
          className={`absolute top-9 -translate-x-1/2 text-[8px] uppercase tracking-wider ${m.textCls}`}
          style={{ left: `${m.p}%` }}
        >
          {m.label}
        </div>
      ))}

      {/* Current price dot */}
      <div
        className="absolute top-5 -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: `${curPct}%` }}
      >
        <div className="relative flex flex-col items-center">
          <span className="absolute -top-6 whitespace-nowrap text-[9px] tt-mono text-white bg-black/80 border border-white/20 rounded px-1 py-0.5 leading-none">
            {formatPrice(currentPrice, digits)}
          </span>
          <span className="block w-3 h-3 rounded-full bg-white ring-2 ring-emerald-400 shadow-[0_0_8px_rgba(255,255,255,0.6)]">
            <span className="absolute inset-0 rounded-full bg-white/40 animate-ping" />
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  valueClass,
  badgeClass,
  compact,
}: {
  label: string;
  value: string;
  valueClass?: string;
  badgeClass?: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md bg-black/30 border border-white/5 px-1.5 py-1 text-center">
      <div className="text-[8px] uppercase tracking-wider text-slate-500 truncate">
        {label}
      </div>
      {badgeClass ? (
        <span
          className={`inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold uppercase border ${badgeClass} mt-0.5`}
        >
          {value}
        </span>
      ) : (
        <div
          className={`tt-mono ${compact ? "text-[10px]" : "text-[11px]"} font-semibold truncate ${
            valueClass ?? "text-slate-200"
          }`}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  valueClass,
  emphasize,
  compact,
}: {
  label: string;
  value: string;
  valueClass?: string;
  emphasize?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 truncate">
        {label}
      </div>
      <div
        className={`tt-mono ${compact ? "text-[11px]" : emphasize ? "text-base" : "text-sm"} font-semibold truncate ${
          valueClass ?? "text-slate-200"
        }`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function TradeMonitorSkeleton() {
  return (
    <div className="p-3 space-y-2.5">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 bg-white/5" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-white/5 bg-black/20 p-3 space-y-2.5"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20 bg-white/5" />
            <Skeleton className="h-4 w-12 bg-white/5" />
            <Skeleton className="h-4 w-12 bg-white/5" />
            <Skeleton className="h-3 w-12 bg-white/5 ml-auto" />
          </div>
          <Skeleton className="h-8 w-32 bg-white/5" />
          <Skeleton className="h-12 w-full bg-white/5" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-8 bg-white/5" />
            <Skeleton className="h-8 bg-white/5" />
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-8 bg-white/5" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TradeMonitorPanel;
