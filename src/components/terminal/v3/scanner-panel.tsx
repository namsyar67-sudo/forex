"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Loader2,
  Medal,
  RefreshCw,
  ScanLine,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";

type Direction = "long" | "short";
type SignalType = "STRONG_BUY" | "BUY" | "WAIT" | "SELL" | "STRONG_SELL";

interface ScanResult {
  id: string;
  symbol: string;
  confidence: number;
  qualityScore: number;
  signalType: SignalType;
  direction: Direction;
  rank: number;
  reasons: string;
  createdAt: string;
}

interface ScannerResponse {
  results: ScanResult[];
  time: number;
}

function parseReasons(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  } catch {
    // ignore
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

function qualityBarColor(score: number): string {
  if (score > 85) return "bg-emerald-300";
  if (score >= 70) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function rankTint(rank: number): {
  border: string;
  glow: string;
  badge: string;
  label: string;
} | null {
  if (rank === 1)
    return {
      border: "border-amber-400/40",
      glow: "shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_0_18px_-6px_rgba(251,191,36,0.45)]",
      badge: "bg-amber-400/20 text-amber-300 border-amber-400/40",
      label: "GOLD",
    };
  if (rank === 2)
    return {
      border: "border-slate-300/40",
      glow: "shadow-[0_0_0_1px_rgba(203,213,225,0.22),0_0_18px_-6px_rgba(203,213,225,0.35)]",
      badge: "bg-slate-300/15 text-slate-200 border-slate-300/40",
      label: "SILVER",
    };
  if (rank === 3)
    return {
      border: "border-orange-500/40",
      glow: "shadow-[0_0_0_1px_rgba(249,115,22,0.25),0_0_18px_-6px_rgba(249,115,22,0.4)]",
      badge: "bg-orange-500/15 text-orange-300 border-orange-500/40",
      label: "BRONZE",
    };
  return null;
}

export function ScannerPanel() {
  const [data, setData] = useState<ScannerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/scanner", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as ScannerResponse;
      setData(json);
    } catch {
      if (!silent) toast.error("Failed to load scanner results");
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

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scanner", { method: "POST" });
      if (!res.ok) throw new Error("Scan failed");
      const json = await res.json();
      const newSignals = json?.newSignals ?? 0;
      const top = json?.topOpportunities ?? 0;
      if (newSignals > 0) {
        toast.success(
          `Scan complete — ${newSignals} new signal${
            newSignals === 1 ? "" : "s"
          }, ${top} top opportunities`
        );
      } else {
        toast.success(
          `Scan complete — ${top} top opportunities, no new signals`
        );
      }
      await fetchData(true);
    } catch {
      toast.error("Scanner failed to run");
    } finally {
      setScanning(false);
    }
  }, [fetchData]);

  const results = data?.results ?? [];
  const lastTime = data?.time;

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ScanLine className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-sm font-semibold">Market Scanner</span>
          <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
            {lastTime
              ? `· updated ${relativeTime(new Date(lastTime).toISOString())}`
              : "· awaiting scan"}
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
            className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 disabled:opacity-50 transition-colors"
          >
            {scanning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            Run Scan
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <ScannerSkeleton />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <ScanLine className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed mb-3">
              No scan results yet. Click Run Scan to analyze all pairs.
            </p>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-medium disabled:opacity-50"
            >
              Run Scan now
            </button>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {results.map((r) => (
              <ScanRow key={r.id} result={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScanRow({ result }: { result: ScanResult }) {
  const tint = rankTint(result.rank);
  const isLong = result.direction === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const reasons = parseReasons(result.reasons).slice(0, 2);
  const isWait = result.signalType === "WAIT";

  return (
    <div
      className={`relative rounded-lg border ${
        tint ? tint.border : "border-white/5"
      } bg-black/20 px-2.5 py-2 hover:bg-black/30 transition-colors ${
        tint ? tint.glow : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {/* Rank */}
        <div
          className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-md text-[11px] font-bold tt-mono ${
            tint ? tint.badge : "bg-white/5 text-slate-400 border border-white/5"
          }`}
          title={tint?.label ?? `Rank #${result.rank}`}
        >
          {result.rank <= 3 ? (
            <Medal className="w-3.5 h-3.5" />
          ) : (
            <span>#{result.rank}</span>
          )}
        </div>

        {/* Symbol + badges */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs font-bold text-slate-100 truncate">
            {result.symbol}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold uppercase border ${DIRECTION_BADGE[result.direction]}`}
          >
            <DirectionIcon className="w-2.5 h-2.5" />
            {result.direction}
          </span>
          <span
            className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase border ${SIGNAL_TYPE_BADGE[result.signalType]}`}
          >
            {result.signalType.replace(/_/g, " ")}
          </span>
        </div>

        {/* Confidence */}
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            Conf
          </div>
          <div
            className={`tt-mono text-xs font-bold ${
              isWait
                ? "tt-text-dim"
                : result.confidence >= 75
                ? "tt-text-up"
                : result.confidence >= 50
                ? "text-amber-400"
                : "tt-text-down"
            }`}
          >
            {result.confidence.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Quality mini bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] uppercase tracking-wider text-slate-500 shrink-0 w-14">
          Quality
        </span>
        <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden">
          <div
            className={`h-full ${qualityBarColor(result.qualityScore)}`}
            style={{
              width: `${Math.min(100, Math.max(0, result.qualityScore))}%`,
            }}
          />
        </div>
        <span className="tt-mono text-[10px] text-slate-300 w-6 text-right">
          {Math.round(result.qualityScore)}
        </span>
      </div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {reasons.map((r, i) => (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-slate-400 border border-white/5 leading-snug truncate max-w-[180px]"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-1 mt-1.5 text-[9px] text-slate-500">
        <Clock className="w-2.5 h-2.5" />
        {relativeTime(result.createdAt)}
        {tint && (
          <span className="ml-auto uppercase tracking-wider font-semibold text-[8px] opacity-70">
            {tint.label}
          </span>
        )}
      </div>
    </div>
  );
}

function ScannerSkeleton() {
  return (
    <div className="p-2 space-y-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="w-7 h-7 bg-white/5" />
            <Skeleton className="h-3 w-24 bg-white/5" />
            <Skeleton className="h-3 w-10 ml-auto bg-white/5" />
          </div>
          <Skeleton className="h-1 w-full bg-white/5" />
          <div className="flex gap-1">
            <Skeleton className="h-3 w-24 bg-white/5" />
            <Skeleton className="h-3 w-20 bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default ScannerPanel;
