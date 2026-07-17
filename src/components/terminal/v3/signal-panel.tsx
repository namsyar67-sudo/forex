"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Target,
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
  livePnl: number;
  distToTP1?: number;
  distToSL?: number;
  indicators: Record<string, unknown>;
  createdAt: string;
  status?: string;
}

interface ActiveSignalsResponse {
  signals: ActiveSignal[];
  count: number;
  time: number;
}

function digitsFor(symbol: string): number {
  return INSTRUMENT_MAP[symbol]?.digits ?? 5;
}

const DIRECTION_BADGE: Record<Direction, string> = {
  long: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  short: "bg-red-500/15 text-red-400 border-red-500/30",
};

const SIGNAL_TYPE_BADGE: Record<SignalType, string> = {
  STRONG_BUY: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40",
  BUY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  WAIT: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  SELL: "bg-red-500/15 text-red-400 border-red-500/30",
  STRONG_SELL: "bg-red-400/20 text-red-300 border-red-400/40",
};

const RISK_BADGE: Record<RiskLevel, string> = {
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  extreme: "bg-red-500/15 text-red-400 border-red-500/30",
};

function qualityStyle(score: number): {
  bar: string;
  text: string;
  glow?: string;
} {
  if (score > 85)
    return {
      bar: "bg-emerald-300",
      text: "text-emerald-300",
      glow: "shadow-[0_0_10px_rgba(110,231,183,0.55)]",
    };
  if (score >= 70) return { bar: "bg-emerald-500", text: "text-emerald-400" };
  if (score >= 50) return { bar: "bg-amber-500", text: "text-amber-400" };
  return { bar: "bg-red-500", text: "text-red-400" };
}

function pnlColor(v: number): string {
  if (v > 0) return "tt-text-up";
  if (v < 0) return "tt-text-down";
  return "tt-text-dim";
}

function signedPct(v: number): string {
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

export function SignalPanel() {
  const [data, setData] = useState<ActiveSignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/signals/active", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as ActiveSignalsResponse;
      setData(json);
    } catch {
      if (!silent) toast.error("Failed to load active signals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const id = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scanner", { method: "POST" });
      if (!res.ok) throw new Error("Scan failed");
      const json = await res.json();
      const newCount = json?.newSignals ?? 0;
      if (newCount > 0) {
        toast.success(`Scan complete — ${newCount} new signal${newCount === 1 ? "" : "s"} added`);
      } else {
        toast.success("Scan complete — no new high-quality opportunities");
      }
      await fetchData(true);
    } catch {
      toast.error("Scanner failed to run");
    } finally {
      setScanning(false);
    }
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
        const pnl = signal.livePnl;
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

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">Active Signals</span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {count}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            aria-label="Refresh"
            title="Refresh"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
          >
            {scanning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ScanLine className="w-3 h-3" />
            )}
            Scan Now
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <SignalPanelSkeleton />
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
              No active signals. The scanner will generate signals when
              high-quality opportunities appear.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2.5">
            {signals.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                onClose={() => handleClose(s)}
                closing={closingId === s.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SignalCard({
  signal,
  onClose,
  closing,
}: {
  signal: ActiveSignal;
  onClose: () => void;
  closing: boolean;
}) {
  const digits = digitsFor(signal.symbol);
  const qs = qualityStyle(signal.qualityScore);
  const isLong = signal.direction === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const pnl = signal.livePnl;

  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3 hover:bg-black/30 transition-colors">
      {/* Top row */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className="text-sm font-bold text-slate-100">
          {signal.symbol}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${DIRECTION_BADGE[signal.direction]}`}
        >
          <DirectionIcon className="w-2.5 h-2.5" />
          {signal.direction}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${SIGNAL_TYPE_BADGE[signal.signalType]}`}
        >
          {signal.signalType.replace(/_/g, " ")}
        </span>
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-slate-500">
          <Clock className="w-2.5 h-2.5" />
          {relativeTime(signal.createdAt)}
        </span>
      </div>

      {/* Quality Score */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Quality Score
          </span>
          <span className={`tt-mono text-xs font-bold ${qs.text}`}>
            {Math.round(signal.qualityScore)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div
            className={`h-full ${qs.bar} ${qs.glow ?? ""}`}
            style={{
              width: `${Math.min(100, Math.max(0, signal.qualityScore))}%`,
            }}
          />
        </div>
      </div>

      {/* Confidence + Live PnL */}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            Confidence
          </div>
          <div className="tt-mono text-sm font-semibold text-slate-200">
            {signal.confidence.toFixed(0)}%
          </div>
        </div>
        <div className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            Live PnL
          </div>
          <div className={`tt-mono text-sm font-semibold ${pnlColor(pnl)}`}>
            {signedPct(pnl)}
          </div>
        </div>
      </div>

      {/* Price grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        <PriceCell label="Entry" value={formatPrice(signal.entryPrice, digits)} />
        <PriceCell label="Current" value={formatPrice(signal.currentPrice, digits)} />
        <PriceCell
          label="SL"
          value={formatPrice(signal.stopLoss, digits)}
          valueClass="tt-text-down"
        />
        <PriceCell
          label="TP1"
          value={formatPrice(signal.takeProfit1, digits)}
          valueClass="tt-text-up"
        />
        <PriceCell
          label="TP2"
          value={formatPrice(signal.takeProfit2, digits)}
          valueClass="tt-text-up"
        />
        <PriceCell
          label="TP3"
          value={formatPrice(signal.takeProfit3, digits)}
          valueClass="tt-text-up"
        />
      </div>

      {/* RR + Risk + Duration + Probability + Session */}
      <div className="grid grid-cols-2 gap-2 mb-2.5 text-[10px]">
        <KVRow
          icon={<Target className="w-2.5 h-2.5" />}
          label="Risk / Reward"
          value={`1:${signal.riskReward.toFixed(2)}`}
          valueClass="tt-text-accent"
        />
        <KVRow
          icon={<ShieldAlert className="w-2.5 h-2.5" />}
          label="Risk Level"
          value={
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border ${RISK_BADGE[signal.riskLevel]}`}
            >
              {signal.riskLevel}
            </span>
          }
        />
        <KVRow
          icon={<Timer className="w-2.5 h-2.5" />}
          label="Expected Duration"
          value={signal.expectedDuration}
        />
        <KVRow
          icon={<Target className="w-2.5 h-2.5" />}
          label="Probability"
          value={`${signal.expectedProbability.toFixed(0)}%`}
          valueClass="tt-text-up"
        />
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[9px] uppercase tracking-wider text-slate-500">
          Session
        </span>
        <span className="text-[10px] tt-mono text-slate-300">
          {signal.marketSession}
        </span>
      </div>

      {/* Reasons */}
      {signal.reasons.length > 0 && (
        <div className="mb-2.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Reasons
          </div>
          <div className="flex flex-wrap gap-1">
            {signal.reasons.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-start gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 leading-snug"
              >
                <Check className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                <span>{r}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {signal.summary && (
        <p className="text-[11px] text-slate-300 leading-relaxed mb-2.5 line-clamp-2">
          {signal.summary}
        </p>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
        <span className="text-[9px] text-slate-500">
          Updated {relativeTime(new Date().toISOString())}
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
          Close
        </button>
      </div>
    </div>
  );
}

function PriceCell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md bg-black/30 border border-white/5 px-1.5 py-1">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`tt-mono text-[11px] font-medium ${valueClass ?? "text-slate-200"} truncate`}
      >
        {value}
      </div>
    </div>
  );
}

function KVRow({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-1.5 rounded-md bg-black/30 border border-white/5 px-2 py-1.5">
      <div className="flex items-center gap-1 text-slate-500 min-w-0">
        {icon}
        <span className="text-[9px] uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <span
        className={`tt-mono font-medium truncate ${
          typeof value === "string" ? (valueClass ?? "text-slate-200") : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SignalPanelSkeleton() {
  return (
    <div className="p-3 space-y-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-white/5 bg-black/20 p-3 space-y-2.5"
        >
          <Skeleton className="h-4 w-40 bg-white/5" />
          <Skeleton className="h-1.5 w-full bg-white/5" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-9 bg-white/5" />
            <Skeleton className="h-9 bg-white/5" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} className="h-8 bg-white/5" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-7 bg-white/5" />
            <Skeleton className="h-7 bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default SignalPanel;
