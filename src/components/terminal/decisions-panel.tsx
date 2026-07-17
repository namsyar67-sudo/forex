"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  Search,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Decision } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const ACTION_STYLES: Record<string, { badge: string; label: string }> = {
  buy: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "BUY" },
  sell: { badge: "bg-red-500/10 text-red-400 border-red-500/30", label: "SELL" },
  hold: { badge: "bg-slate-500/10 text-slate-300 border-slate-500/30", label: "HOLD" },
  wait: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "WAIT" },
};

const TREND_STYLES: Record<string, string> = {
  Bullish: "tt-text-up",
  Bearish: "tt-text-down",
  Sideways: "tt-text-dim",
};

function riskTone(score: number): "up" | "down" | "neutral" {
  if (score > 60) return "down";
  if (score > 35) return "neutral";
  return "up";
}

function riskClass(score: number): string {
  if (score > 60) return "tt-text-down";
  if (score > 35) return "text-amber-400";
  return "tt-text-up";
}

export function DecisionsPanel() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDecisions = useCallback(async () => {
    try {
      const res = await fetch("/api/decisions?limit=30", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setDecisions(data.decisions ?? []);
    } catch {
      // silent fail on background refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecisions();
    const id = setInterval(fetchDecisions, 10000);
    return () => clearInterval(id);
  }, [fetchDecisions]);

  const filtered = useMemo(() => {
    const q = symbolFilter.trim().toUpperCase();
    if (!q) return decisions;
    return decisions.filter((d) => d.symbol.toUpperCase().includes(q));
  }, [decisions, symbolFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">AI Decisions</span>
          <span className="text-xs text-slate-500 truncate">· {filtered.length}</span>
        </div>
        <div className="relative w-32 shrink-0">
          <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
          <Input
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            placeholder="Filter…"
            className="h-7 pl-6 pr-2 text-[11px] bg-black/30 border-white/10 placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              {symbolFilter
                ? `No decisions match "${symbolFilter}".`
                : "No AI decisions yet. Decisions are generated automatically when high-confidence signals appear."}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {filtered.map((d) => {
              const style = ACTION_STYLES[d.action] ?? ACTION_STYLES.hold;
              const expanded = expandedId === d.id;
              const trendClass = TREND_STYLES[d.trend] ?? "tt-text-dim";
              return (
                <div
                  key={d.id}
                  className="rounded-lg border border-white/5 bg-black/20 hover:bg-black/30 transition-colors"
                >
                  {/* Top row */}
                  <button
                    onClick={() => toggleExpand(d.id)}
                    className="w-full text-left p-2.5 flex items-center gap-2.5"
                  >
                    {/* Action badge */}
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-12 px-1.5 py-1 rounded text-[10px] font-bold border ${style.badge}`}
                    >
                      {style.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-slate-100">{d.symbol}</span>
                        <span className={`text-[10px] ${trendClass} flex items-center gap-0.5`}>
                          {d.trend === "Bullish" ? (
                            <TrendingUp className="w-2.5 h-2.5" />
                          ) : d.trend === "Bearish" ? (
                            <TrendingDown className="w-2.5 h-2.5" />
                          ) : null}
                          {d.trend}
                        </span>
                        <span className="text-[9px] text-slate-500 ml-auto">{relativeTime(d.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{d.summary}</p>
                    </div>

                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Metrics row */}
                  <div className="px-2.5 pb-2 grid grid-cols-4 gap-1.5 text-[10px]">
                    <Metric label="Conf" value={`${d.confidence}%`} tone="neutral" />
                    <Metric
                      label="Risk"
                      value={`${d.riskScore}`}
                      tone={riskTone(d.riskScore)}
                      valueClass={riskClass(d.riskScore)}
                    />
                    <Metric label="Vol" value={d.volatility} tone="dim" />
                    <Metric label="Session" value={d.session} tone="dim" />
                  </div>

                  {/* Expanded rationale */}
                  {expanded && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                      {/* Trade setup */}
                      <div className="rounded-md bg-black/30 border border-white/5 p-2">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <Target className="w-2.5 h-2.5" /> Trade Setup
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Entry</div>
                            <div className="tt-mono text-slate-300 truncate">{d.entryZone}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">SL</div>
                            <div className="tt-mono tt-text-down">{d.stopLoss}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">TP</div>
                            <div className="tt-mono tt-text-up">{d.takeProfit}</div>
                          </div>
                        </div>
                      </div>

                      {/* Rationale */}
                      <div className="rounded-md bg-white/[0.02] border border-white/5 p-2">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" /> Rationale
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {d.rationale || "No rationale provided."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  valueClass,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral" | "dim";
  valueClass?: string;
}) {
  const color =
    valueClass ??
    (tone === "up"
      ? "tt-text-up"
      : tone === "down"
      ? "tt-text-down"
      : tone === "dim"
      ? "tt-text-dim"
      : "text-slate-200");
  return (
    <div className="rounded-md bg-black/20 px-1.5 py-1 border border-white/5">
      <div className="text-[8px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-[11px] tt-mono ${color} truncate`}>{value}</div>
    </div>
  );
}
