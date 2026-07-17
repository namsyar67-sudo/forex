"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  History,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, relativeTime } from "@/lib/format";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";

type Direction = "long" | "short";
type SignalType = "STRONG_BUY" | "BUY" | "WAIT" | "SELL" | "STRONG_SELL";

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
  riskLevel: string;
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

interface HistoryResponse {
  signals: ActiveSignal[];
  time: number;
}

const REFRESH_INTERVAL = 30_000;
const HISTORY_STATUSES = "closed_win,closed_loss,closed_manual,invalidated";

const DIRECTION_BADGE: Record<Direction, string> = {
  long: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  short: "bg-red-500/15 text-red-400 border-red-500/30",
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

interface Outcome {
  label: string;
  cls: string;
  icon: "win" | "loss" | "manual" | "invalid";
}

function outcomeFor(status: string): Outcome {
  switch (status) {
    case "closed_win":
      return {
        label: "WIN",
        cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        icon: "win",
      };
    case "closed_loss":
      return {
        label: "LOSS",
        cls: "bg-red-500/15 text-red-400 border-red-500/30",
        icon: "loss",
      };
    case "closed_manual":
      return {
        label: "MANUAL",
        cls: "bg-slate-500/15 text-slate-400 border-slate-500/30",
        icon: "manual",
      };
    case "invalidated":
      return {
        label: "INVALID",
        cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        icon: "invalid",
      };
    default:
      return {
        label: status.toUpperCase(),
        cls: "bg-slate-500/15 text-slate-400 border-slate-500/30",
        icon: "manual",
      };
  }
}

function OutcomeIcon({ kind }: { kind: Outcome["icon"] }) {
  switch (kind) {
    case "win": return <CheckCircle2 className="w-3 h-3" />;
    case "loss": return <XCircle className="w-3 h-3" />;
    default: return <Clock className="w-3 h-3" />;
  }
}

function durationLabel(startIso: string, endIso: string | null | undefined): string {
  if (!endIso) return "—";
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!isFinite(start) || !isFinite(end) || end <= start) return "—";
  const ms = end - start;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hrs < 24) return remMin ? `${hrs}h ${remMin}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs ? `${days}d ${remHrs}h` : `${days}d`;
}

interface SignalHistoryPanelProps {
  onSelectSignal?: (signalId: string) => void;
}

export function SignalHistoryPanel({ onSelectSignal }: SignalHistoryPanelProps) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const url = `/api/signals?status=${encodeURIComponent(HISTORY_STATUSES)}&limit=50`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as HistoryResponse;
      setData(json);
    } catch {
      if (!silent) toast.error("Failed to load signal history");
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

  const signals = data?.signals ?? [];

  const stats = useMemo(() => {
    const total = signals.length;
    const wins = signals.filter((s) => s.status === "closed_win").length;
    const losses = signals.filter((s) => s.status === "closed_loss").length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const avgConfidence =
      total > 0
        ? Math.round(
            signals.reduce((s, x) => s + (x.confidence ?? 0), 0) / total
          )
        : 0;
    return { total, wins, losses, winRate, avgConfidence };
  }, [signals]);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-sm font-semibold">Signal History</span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30 tt-mono">
            {stats.total}
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

      {/* Stats row */}
      {!loading && signals.length > 0 && (
        <div className="grid grid-cols-5 gap-2 p-3 border-b border-white/5 bg-black/20">
          <HistoryStat
            label="Win Rate"
            value={`${stats.winRate}%`}
            valueClass={stats.winRate >= 50 ? "tt-text-up" : "tt-text-down"}
            emphasize
          />
          <HistoryStat
            label="Total"
            value={`${stats.total}`}
          />
          <HistoryStat
            label="Wins"
            value={`${stats.wins}`}
            valueClass="tt-text-up"
          />
          <HistoryStat
            label="Losses"
            value={`${stats.losses}`}
            valueClass="tt-text-down"
          />
          <HistoryStat
            label="Avg Conf"
            value={`${stats.avgConfidence}%`}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading ? (
          <HistorySkeleton />
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <History className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed">
              No signal history yet. Closed signals will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {signals.map((s) => (
              <HistoryRow
                key={s.id}
                signal={s}
                onSelect={onSelectSignal ? () => onSelectSignal(s.id) : undefined}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HistoryRow({
  signal,
  onSelect,
}: {
  signal: ActiveSignal;
  onSelect?: () => void;
}) {
  const digits = digitsFor(signal.symbol);
  const isLong = signal.direction === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const outcome = outcomeFor(signal.status);
  const pnl = signal.closePnl ?? signal.livePnl ?? 0;
  const closePrice = signal.currentPrice;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        className={`w-full text-left p-3 transition-colors border-l-2 ${
          onSelect
            ? "border-transparent hover:bg-white/[0.03] hover:border-sky-400/50 cursor-pointer"
            : "border-transparent"
        }`}
      >
        {/* Top row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`text-sm font-bold ${onSelect ? "text-slate-100" : "text-slate-100"}`}>
            {signal.symbol}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${DIRECTION_BADGE[signal.direction]}`}
          >
            <DirectionIcon className="w-2.5 h-2.5" />
            {signal.direction}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">
            {signal.signalType.replace(/_/g, " ")}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${outcome.cls}`}
          >
            <OutcomeIcon kind={outcome.icon} />
            {outcome.label}
          </span>
          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-slate-500">
            <Clock className="w-2.5 h-2.5" />
            {signal.closedAt ? relativeTime(signal.closedAt) : relativeTime(signal.createdAt)}
          </span>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-4 gap-2 text-[10px]">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">
              Entry → Close
            </div>
            <div className="tt-mono text-slate-300 truncate">
              {formatPrice(signal.entryPrice, digits)} →{" "}
              {formatPrice(closePrice, digits)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">
              PnL %
            </div>
            <div className={`tt-mono font-semibold ${pnlColor(pnl)}`}>
              {signedPct(pnl)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">
              Conf / Quality
            </div>
            <div className="tt-mono text-slate-300">
              {signal.confidence.toFixed(0)}% ·{" "}
              <span className="tt-text-accent">
                {Math.round(signal.qualityScore)}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">
              Duration
            </div>
            <div className="tt-mono text-slate-300">
              {durationLabel(signal.createdAt, signal.closedAt)}
            </div>
          </div>
        </div>

        {/* Close reason */}
        {signal.closeReason && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
            <span className="text-[9px] uppercase tracking-wider">Reason:</span>
            <span className="text-slate-400 italic truncate">
              {signal.closeReason}
            </span>
          </div>
        )}
      </button>
    </li>
  );
}

function HistoryStat({
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
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 truncate">
        {label}
      </div>
      <div
        className={`tt-mono ${emphasize ? "text-base" : "text-sm"} font-bold truncate ${
          valueClass ?? "text-slate-200"
        }`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 bg-white/5" />
            <Skeleton className="h-4 w-12 bg-white/5" />
            <Skeleton className="h-4 w-14 bg-white/5" />
            <Skeleton className="h-4 w-12 bg-white/5" />
            <Skeleton className="h-3 w-10 bg-white/5 ml-auto" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Skeleton className="h-7 bg-white/5" />
            <Skeleton className="h-7 bg-white/5" />
            <Skeleton className="h-7 bg-white/5" />
            <Skeleton className="h-7 bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default SignalHistoryPanel;
