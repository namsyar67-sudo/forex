"use client";

/**
 * PriceActionPanel (V2)
 * ---------------------
 * Displays detected candlestick / chart-formation patterns from
 * `/api/price-action/[symbol]?tf=h1`.
 *
 * Layout:
 *   - Header: title + pattern-count badge + refresh
 *   - Stats row: bullish / bearish / net bias / compression / volatility
 *   - Latest pattern highlighted card
 *   - Scrollable list of the 15 most recent patterns
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CandlestickChart,
  Gauge,
  Loader2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import type { PriceActionAnalysis, Pattern } from "@/lib/price-action/engine";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";
import { formatPrice, relativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PriceActionPanelProps {
  symbol: string;
}

const DIRECTION_STYLES: Record<
  Pattern["direction"],
  { badge: string; label: string; bar: string }
> = {
  bullish: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    label: "Bull",
    bar: "bg-emerald-400",
  },
  bearish: {
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    label: "Bear",
    bar: "bg-red-400",
  },
  neutral: {
    badge: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    label: "Neutral",
    bar: "bg-slate-400",
  },
};

const BIAS_STYLES: Record<string, string> = {
  bullish: "tt-text-up",
  bearish: "tt-text-down",
  neutral: "tt-text-dim",
};

const VOL_STYLES: Record<string, string> = {
  low: "tt-text-dim",
  normal: "tt-text-up",
  high: "tt-text-accent",
};

function titleCasePattern(type: string): string {
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function digitsFor(symbol: string): number {
  return INSTRUMENT_MAP[symbol.toUpperCase()]?.digits ?? 5;
}

function isoFromUnixSeconds(t: number): string {
  return new Date(t * 1000).toISOString();
}

export function PriceActionPanel({ symbol }: PriceActionPanelProps) {
  const [analysis, setAnalysis] = useState<PriceActionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = useMemo(() => digitsFor(symbol), [symbol]);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setRefreshing(true);
      }
      try {
        const res = await fetch(
          `/api/price-action/${encodeURIComponent(symbol.toUpperCase())}?tf=h1`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.analysis) throw new Error("Bad payload");
        setAnalysis(data.analysis as PriceActionAnalysis);
        setError(null);
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [symbol]
  );

  useEffect(() => {
    setLoading(true);
    setAnalysis(null);
    setError(null);
    fetchData(false);
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const recent = useMemo(() => {
    if (!analysis?.patterns) return [];
    return [...analysis.patterns].slice(-15).reverse();
  }, [analysis]);

  const latest = analysis?.latestPattern ?? null;

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CandlestickChart className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold">Price Action</span>
          <span className="text-[10px] text-slate-500 truncate tt-mono">
            · {symbol.toUpperCase()} · H1
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {analysis && (
            <Badge
              variant="outline"
              className="bg-white/5 border-white/10 text-slate-300 tt-mono"
            >
              {analysis.patternCount}
            </Badge>
          )}
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            aria-label="Refresh price action"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 p-3 space-y-3 overflow-hidden">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-white/5" />
            ))}
          </div>
          <Skeleton className="h-24 w-full bg-white/5" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-white/5" />
            ))}
          </div>
        </div>
      ) : error || !analysis ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed mb-3">
            {error
              ? `Failed to load price action: ${error}`
              : "No price action data available."}
          </p>
          <button
            onClick={() => fetchData(false)}
            className="text-[11px] px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-5 gap-2 p-3 border-b border-white/5">
            <Stat
              label="Bull"
              value={String(analysis.bullishPatterns)}
              tone="up"
              icon={<TrendingUp className="w-3 h-3" />}
            />
            <Stat
              label="Bear"
              value={String(analysis.bearishPatterns)}
              tone="down"
              icon={<TrendingDown className="w-3 h-3" />}
            />
            <Stat
              label="Bias"
              value={analysis.netBias}
              tone={
                analysis.netBias === "bullish"
                  ? "up"
                  : analysis.netBias === "bearish"
                  ? "down"
                  : "neutral"
              }
            />
            <Stat
              label="Comp"
              value={analysis.compressionActive ? "ON" : "OFF"}
              tone={analysis.compressionActive ? "accent" : "dim"}
              icon={<Waves className="w-3 h-3" />}
            />
            <Stat
              label="Vol"
              value={analysis.recentVolatility}
              tone={
                analysis.recentVolatility === "high"
                  ? "accent"
                  : analysis.recentVolatility === "low"
                  ? "dim"
                  : "neutral"
              }
              icon={<Gauge className="w-3 h-3" />}
            />
          </div>

          {/* Latest pattern highlighted card */}
          {latest ? (
            <div className="p-3 border-b border-white/5">
              <div className="rounded-lg border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    Latest Pattern
                  </span>
                  <span className="text-[10px] text-slate-500 ml-auto tt-mono">
                    {relativeTime(isoFromUnixSeconds(latest.time))}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-slate-100">
                    {titleCasePattern(latest.type)}
                  </span>
                  <DirectionBadge direction={latest.direction} />
                  <span className="text-[10px] text-slate-500 ml-auto tt-mono">
                    @ {formatPrice(latest.price, digits)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug mb-1.5">
                  {latest.description}
                </p>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {latest.interpretation}
                </p>
                {/* Confidence bar */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500">
                    Conf
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${
                        DIRECTION_STYLES[latest.direction].bar
                      }`}
                      style={{ width: `${Math.round(latest.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] tt-mono text-slate-300">
                    {Math.round(latest.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Recent patterns list */}
          <div className="flex-1 overflow-y-auto tt-scroll">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
                <p className="text-xs text-slate-500">
                  No patterns detected in the recent window.
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {recent.map((p, i) => (
                  <PatternRow
                    key={`${p.type}-${p.index}-${i}`}
                    pattern={p}
                    digits={digits}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

interface StatProps {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral" | "accent" | "dim";
  icon?: React.ReactNode;
}

function Stat({ label, value, tone, icon }: StatProps) {
  const toneClass =
    tone === "up"
      ? "tt-text-up"
      : tone === "down"
      ? "tt-text-down"
      : tone === "accent"
      ? "tt-text-accent"
      : tone === "dim"
      ? "tt-text-dim"
      : "text-slate-200";
  return (
    <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5 flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span
        className={`text-xs font-semibold capitalize tt-mono truncate ${toneClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: Pattern["direction"] }) {
  const s = DIRECTION_STYLES[direction];
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${s.badge}`}
    >
      {direction === "bullish" ? (
        <TrendingUp className="w-2.5 h-2.5" />
      ) : direction === "bearish" ? (
        <TrendingDown className="w-2.5 h-2.5" />
      ) : (
        <Minus className="w-2.5 h-2.5" />
      )}
      {s.label}
    </span>
  );
}

function PatternRow({
  pattern,
  digits,
}: {
  pattern: Pattern;
  digits: number;
}) {
  const s = DIRECTION_STYLES[pattern.direction];
  const confPct = Math.round(pattern.confidence * 100);
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 hover:bg-black/30 transition-colors p-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-slate-100 truncate flex-1 min-w-0">
          {titleCasePattern(pattern.type)}
        </span>
        <DirectionBadge direction={pattern.direction} />
      </div>
      <div className="flex items-center gap-2 mb-1">
        {/* Confidence bar */}
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full ${s.bar}`}
            style={{ width: `${confPct}%` }}
          />
        </div>
        <span className="text-[9px] tt-mono text-slate-400 w-7 text-right">
          {confPct}%
        </span>
        <span className="text-[9px] tt-mono text-slate-500 w-12 text-right">
          {relativeTime(isoFromUnixSeconds(pattern.time))}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-400 leading-snug truncate flex-1 min-w-0">
          {pattern.interpretation}
        </p>
        <span className="text-[9px] tt-mono text-slate-500 shrink-0">
          {formatPrice(pattern.price, digits)}
        </span>
      </div>
    </div>
  );
}

export default PriceActionPanel;
