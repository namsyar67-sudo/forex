"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock,
  History,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { relativeTime, formatTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type DecisionAction = "buy" | "sell" | "hold" | "wait";

interface DecisionTimelineEntry {
  id: string;
  symbol: string;
  action: DecisionAction;
  confidence: number;
  reason: string;
  signalScore: number;
  trend: string;
  context: string;
  createdAt: string;
}

interface Transition {
  from: string;
  to: string;
  count: number;
}

interface TimelineResponse {
  entries: DecisionTimelineEntry[];
  transitions: Transition[];
  total: number;
  time?: number;
}

const ACTION_META: Record<
  DecisionAction,
  { label: string; badge: string; dot: string; bar: string; text: string }
> = {
  buy: {
    label: "BUY",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400 ring-emerald-500/30",
    bar: "bg-emerald-400",
    text: "tt-text-up",
  },
  sell: {
    label: "SELL",
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    dot: "bg-red-400 ring-red-500/30",
    bar: "bg-red-400",
    text: "tt-text-down",
  },
  hold: {
    label: "HOLD",
    badge: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    dot: "bg-slate-400 ring-slate-500/30",
    bar: "bg-slate-400",
    text: "tt-text-dim",
  },
  wait: {
    label: "WAIT",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400 ring-amber-500/30",
    bar: "bg-amber-400",
    text: "tt-text-accent",
  },
};

const TREND_CLASS: Record<string, string> = {
  Bullish: "tt-text-up",
  Bearish: "tt-text-down",
  Sideways: "tt-text-dim",
};

function actionMeta(action: string) {
  return ACTION_META[(action as DecisionAction) ?? "hold"] ?? ACTION_META.hold;
}

interface DecisionTimelinePanelProps {
  symbol: string;
}

export function DecisionTimelinePanel({ symbol }: DecisionTimelinePanelProps) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await fetch(
          `/api/decision-timeline/${encodeURIComponent(symbol.toUpperCase())}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as TimelineResponse;
        setData(json);
      } catch {
        if (!silent) toast.error("Failed to load decision timeline");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [symbol]
  );

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData(false);
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const entries = data?.entries ?? [];
  const transitions = data?.transitions ?? [];
  const total = data?.total ?? 0;

  const topTransitions = useMemo(() => {
    return [...transitions].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [transitions]);

  // Last 14 actions rendered as a colored flow bar (oldest -> newest, left -> right)
  const flowSegments = useMemo(() => {
    return [...entries].slice(0, 14).reverse();
  }, [entries]);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">Decision Timeline</span>
          <span className="text-xs text-slate-500 truncate">
            · {symbol.toUpperCase()} · {total} decisions
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
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-2 h-2 rounded-full bg-white/5 mt-1" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24 bg-white/5" />
                  <Skeleton className="h-4 w-full bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <History className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              No decision history for {symbol.toUpperCase()} yet. Use ReAnalyze
              to record the first decision.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Visual flow bar */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                Recent flow
              </div>
              <div className="flex items-center gap-0.5 h-2.5 rounded overflow-hidden bg-black/30">
                {flowSegments.length === 0 ? (
                  <div className="flex-1 h-full bg-white/5" />
                ) : (
                  flowSegments.map((e, i) => {
                    const meta = actionMeta(e.action);
                    return (
                      <div
                        key={e.id}
                        title={`${meta.label} · ${formatTime(e.createdAt)}`}
                        className={`flex-1 h-full ${meta.bar} opacity-80 hover:opacity-100 transition-opacity`}
                        style={{ minWidth: 4 }}
                      >
                        {i === 0 && <span className="sr-only">{meta.label}</span>}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between mt-1 text-[9px] text-slate-600">
                <span>older</span>
                <span>newer</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative pl-5">
              {/* Vertical line */}
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-white/10" />

              <div className="space-y-3">
                {entries.map((entry, idx) => {
                  const meta = actionMeta(entry.action);
                  const prev = idx < entries.length - 1 ? entries[idx + 1] : null;
                  const prevMeta = prev ? actionMeta(prev.action) : null;
                  const trendClass =
                    TREND_CLASS[entry.trend] ?? "tt-text-dim";

                  return (
                    <div key={entry.id} className="relative">
                      {/* Dot */}
                      <span
                        className={`absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full ring-2 ${meta.dot}`}
                      />

                      {/* Content */}
                      <div className="rounded-lg border border-white/5 bg-black/20 hover:bg-black/30 transition-colors p-2.5">
                        {/* Top row: time + transition */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] text-slate-500 tt-mono flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatTime(entry.createdAt)}
                          </span>
                          <span className="text-[9px] text-slate-600">
                            {relativeTime(entry.createdAt)}
                          </span>
                          <span className="ml-auto text-[9px] text-slate-600 tt-mono">
                            #{total - idx}
                          </span>
                        </div>

                        {/* Action + transition */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {prevMeta && (
                            <>
                              <span
                                className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold border opacity-60 ${prevMeta.badge}`}
                              >
                                {prevMeta.label}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                            </>
                          )}
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badge}`}
                          >
                            {meta.label}
                          </span>

                          <div className="ml-auto flex items-center gap-2 text-[10px]">
                            <span className="flex items-center gap-1">
                              <span className="text-slate-500 uppercase tracking-wider text-[9px]">
                                Conf
                              </span>
                              <span className="tt-mono text-slate-200">
                                {Math.round(entry.confidence)}%
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="text-slate-500 uppercase tracking-wider text-[9px]">
                                Sig
                              </span>
                              <span className="tt-mono text-slate-200">
                                {Math.round(entry.signalScore)}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Trend + reason */}
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] flex items-center gap-0.5 ${trendClass}`}
                          >
                            {entry.trend === "Bullish" ? (
                              <TrendingUp className="w-2.5 h-2.5" />
                            ) : entry.trend === "Bearish" ? (
                              <TrendingDown className="w-2.5 h-2.5" />
                            ) : (
                              <Minus className="w-2.5 h-2.5" />
                            )}
                            {entry.trend}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-1">
                          {entry.reason}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transitions summary */}
            {topTransitions.length > 0 && (
              <div className="rounded-lg border border-white/5 bg-black/20 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                  Top transitions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {topTransitions.map((t, i) => {
                    const from = actionMeta(t.from);
                    const to = actionMeta(t.to);
                    return (
                      <span
                        key={`${t.from}-${t.to}-${i}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/40 border border-white/5 text-[10px]"
                      >
                        <span className={`font-bold ${from.text}`}>
                          {from.label}
                        </span>
                        <ArrowRight className="w-2.5 h-2.5 text-slate-500" />
                        <span className={`font-bold ${to.text}`}>
                          {to.label}
                        </span>
                        <span className="tt-mono text-slate-400 ml-0.5">
                          ×{t.count}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DecisionTimelinePanel;
