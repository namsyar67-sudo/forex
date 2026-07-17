"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Types (mirror /api/session-analysis -> lib/session-analysis/engine) ---------- */
interface SessionStats {
  name: string;
  active: boolean;
  volMultiplier: number;
  trend: "Bullish" | "Bearish" | "Mixed";
  avgVolume: number;
  volatility: number; // 0..100
  liquidity: "Thin" | "Normal" | "Deep";
  rangePct: number;
  instrumentsUp: number;
  instrumentsDown: number;
  bestSymbol: string;
  bestChange: number;
}

interface SessionAnalysisResult {
  sessions: SessionStats[];
  currentSession: SessionStats;
  bestSession: SessionStats;
  summary: string;
}

const REFRESH_INTERVAL = 30_000;

function trendClass(trend: SessionStats["trend"]): string {
  if (trend === "Bullish") return "text-emerald-400";
  if (trend === "Bearish") return "text-red-400";
  return "text-slate-400";
}

function liquidityClass(liq: SessionStats["liquidity"]): string {
  if (liq === "Deep")
    return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
  if (liq === "Normal")
    return "text-slate-300 bg-slate-500/10 border-slate-500/30";
  return "text-red-300 bg-red-500/10 border-red-500/30";
}

function volatilityColor(v: number): string {
  if (v >= 75) return "rgba(239, 68, 68, 0.9)";
  if (v >= 55) return "rgba(249, 115, 22, 0.85)";
  if (v >= 35) return "rgba(245, 158, 11, 0.8)";
  return "rgba(16, 185, 129, 0.75)";
}

function SessionRow({
  session,
  highlight,
}: {
  session: SessionStats;
  highlight?: boolean;
}) {
  return (
    <div
      className={`px-3 py-2.5 border-b border-white/5 transition-colors ${
        highlight
          ? "bg-amber-500/[0.04]"
          : session.active
          ? "bg-emerald-500/[0.03]"
          : ""
      }`}
    >
      {/* Name + badges + vol multiplier */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-xs font-semibold text-slate-100 truncate">
            {session.name}
          </span>
          {session.active && (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 tt-pulse-dot" />
              Active
            </span>
          )}
          {highlight && (
            <span className="text-[9px] uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5">
              Most Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] uppercase tracking-wider text-slate-500">
            Vol
          </span>
          <span className="tt-mono text-[11px] text-slate-200 font-semibold">
            ×{session.volMultiplier.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Stats grid: Trend / Liquidity / Range */}
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            Trend
          </div>
          <div className={`font-semibold ${trendClass(session.trend)}`}>
            {session.trend}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            Liquidity
          </div>
          <span
            className={`inline-block px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wider ${liquidityClass(
              session.liquidity,
            )}`}
          >
            {session.liquidity}
          </span>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            Range
          </div>
          <div className="tt-mono text-slate-300 font-semibold">
            {session.rangePct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Volatility bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-500 mb-1">
          <span>Volatility</span>
          <span className="tt-mono text-slate-300">
            {session.volatility}
            <span className="text-slate-600">/100</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(2, Math.min(100, session.volatility))}%`,
              backgroundColor: volatilityColor(session.volatility),
            }}
          />
        </div>
      </div>

      {/* Up/Down + Best symbol */}
      <div className="flex items-center justify-between text-[10px] gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="uppercase tracking-wider text-slate-500">U/D</span>
          <span className="tt-mono tt-text-up">{session.instrumentsUp}</span>
          <span className="text-slate-600">/</span>
          <span className="tt-mono tt-text-down">{session.instrumentsDown}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="uppercase tracking-wider text-slate-500 shrink-0">
            Best
          </span>
          <span className="tt-mono text-slate-200 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 truncate">
            {session.bestSymbol}
          </span>
          <span
            className={`tt-mono font-semibold shrink-0 ${
              session.bestChange >= 0 ? "tt-text-up" : "tt-text-down"
            }`}
          >
            {session.bestChange >= 0 ? "+" : ""}
            {session.bestChange.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function SessionSkeleton() {
  return (
    <div className="px-3 py-2.5 border-b border-white/5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24 bg-white/5" />
          <Skeleton className="h-3 w-12 bg-white/5" />
        </div>
        <Skeleton className="h-3 w-10 bg-white/5" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-6 w-full bg-white/5" />
        <Skeleton className="h-6 w-full bg-white/5" />
        <Skeleton className="h-6 w-full bg-white/5" />
      </div>
      <Skeleton className="h-1.5 w-full bg-white/5" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16 bg-white/5" />
        <Skeleton className="h-3 w-28 bg-white/5" />
      </div>
    </div>
  );
}

export function SessionAnalysisPanel() {
  const [data, setData] = useState<SessionAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/session-analysis", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SessionAnalysisResult;
      setData(json);
    } catch {
      setError("Failed to load session analysis.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  const sessions = data?.sessions ?? [];
  const current = data?.currentSession ?? null;
  const best = data?.bestSession ?? null;
  const summary = data?.summary ?? "";

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-sm font-semibold truncate">Session Analysis</span>
          {current && (
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5 shrink-0">
              {current.name}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fetchData()}
          disabled={refreshing}
          className="h-7 w-7 p-0 shrink-0"
          title="Refresh"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Summary line */}
      {summary && (
        <div className="px-3 py-2 border-b border-white/5 text-[10px] text-slate-400 leading-relaxed">
          {summary}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SessionSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-xs text-slate-400 mb-2">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchData()}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No session data available.
          </div>
        ) : (
          <div>
            {/* Best session highlighted at top */}
            {best && <SessionRow session={best} highlight />}
            {/* Remaining sessions (excluding the best session instance to avoid duplicate) */}
            {sessions
              .filter((s) => s.name !== best?.name)
              .map((s) => (
                <SessionRow key={s.name} session={s} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionAnalysisPanel;
