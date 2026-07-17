"use client";

import { useState, useEffect, useCallback } from "react";
import { Flame, RefreshCw, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Types (mirror /api/heatmap -> lib/heatmap/engine) ---------- */
interface CurrencyStrength {
  currency: string;
  strength: number; // -100..100
  change: number; // avg % change
  pairs: { symbol: string; changePct: number }[];
  rank: number;
  label: "Strong" | "Bullish" | "Neutral" | "Bearish" | "Weak";
}

interface HeatmapData {
  currencies: CurrencyStrength[];
  timestamp: number;
  topCurrency: CurrencyStrength | null;
  bottomCurrency: CurrencyStrength | null;
}

const REFRESH_INTERVAL = 15_000; // 15s auto-refresh

/**
 * Returns an inline-style background color reflecting currency strength.
 * strength 100  -> full emerald rgba(16,185,129,0.9)
 * strength -100 -> full red     rgba(239,68,68,0.9)
 * strength 0    -> transparent
 */
function heatColor(strength: number): string {
  const v = Math.max(-100, Math.min(100, strength));
  if (v === 0) return "transparent";
  const alpha = ((Math.abs(v) / 100) * 0.9).toFixed(3);
  return v > 0
    ? `rgba(16, 185, 129, ${alpha})`
    : `rgba(239, 68, 68, ${alpha})`;
}

function strengthTextClass(strength: number): string {
  if (strength > 50) return "text-white";
  if (strength > 15) return "text-emerald-50";
  if (strength >= -15) return "text-slate-200";
  if (strength >= -50) return "text-red-50";
  return "text-white";
}

function labelClass(label: CurrencyStrength["label"]): string {
  switch (label) {
    case "Strong":
      return "text-emerald-300 bg-black/40 border-emerald-500/40";
    case "Bullish":
      return "text-emerald-300/90 bg-black/40 border-emerald-500/25";
    case "Neutral":
      return "text-slate-300 bg-black/40 border-slate-500/30";
    case "Bearish":
      return "text-red-300/90 bg-black/40 border-red-500/25";
    case "Weak":
      return "text-red-300 bg-black/40 border-red-500/40";
  }
}

export function HeatmapPanel() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/heatmap", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as HeatmapData;
      setData(json);
    } catch {
      setError("Failed to load currency strength heatmap.");
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

  const currencies = data?.currencies ?? [];
  const top = data?.topCurrency ?? null;
  const bottom = data?.bottomCurrency ?? null;

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold truncate">Currency Strength Heatmap</span>
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

      {/* Strongest / Weakest badges */}
      {(top || bottom) && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 text-[10px]">
          <span className="uppercase tracking-wider text-slate-500">Strongest</span>
          {top && (
            <span className="tt-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
              <ArrowUp className="w-2.5 h-2.5" />
              {top.currency}
              <span className="text-emerald-400">
                {top.strength > 0 ? "+" : ""}
                {top.strength}
              </span>
            </span>
          )}
          <span className="ml-auto uppercase tracking-wider text-slate-500">Weakest</span>
          {bottom && (
            <span className="tt-mono text-red-300 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
              <ArrowDown className="w-2.5 h-2.5" />
              {bottom.currency}
              <span className="text-red-400">{bottom.strength}</span>
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0 p-3">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 17 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-md bg-white/5" />
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
        ) : currencies.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No currency strength data available.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {currencies.map((c) => (
              <div
                key={c.currency}
                className="relative rounded-md border border-white/5 p-2.5 overflow-hidden transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: heatColor(c.strength) }}
                title={`${c.currency} · ${c.pairs.length} pairs tracked · strength ${c.strength}`}
              >
                {/* Top row: code + rank */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white tracking-wide">
                    {c.currency}
                  </span>
                  <span className="text-[10px] tt-mono text-slate-200/70">
                    #{c.rank}
                  </span>
                </div>

                {/* Strength value */}
                <div
                  className={`tt-mono text-2xl font-bold leading-tight ${strengthTextClass(
                    c.strength,
                  )}`}
                >
                  {c.strength > 0 ? "+" : ""}
                  {c.strength}
                </div>

                {/* Bottom row: label + avg change */}
                <div className="flex items-center justify-between mt-1.5">
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${labelClass(
                      c.label,
                    )}`}
                  >
                    {c.label}
                  </span>
                  <span
                    className={`tt-mono text-[10px] font-semibold ${
                      c.change > 0
                        ? "tt-text-up"
                        : c.change < 0
                        ? "tt-text-down"
                        : "text-slate-300"
                    }`}
                  >
                    {c.change >= 0 ? "+" : ""}
                    {c.change.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HeatmapPanel;
