"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Brain,
  Check,
  Minus,
  RefreshCw,
  Target,
  X,
} from "lucide-react";
import { relativeTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type PredictedAction = "buy" | "sell" | "hold" | "wait";
type ActualOutcome = "up" | "down" | "flat";

interface AIMemoryEntry {
  id: string;
  symbol: string;
  predictedAction: PredictedAction;
  predictedConfidence: number;
  predictedDirection: string;
  actualOutcome: ActualOutcome | "";
  priceAtPrediction: number;
  priceAtOutcome: number;
  correct: boolean;
  accuracyScore: number;
  analysis: string | null;
  learnedFactors: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface TrendBucket {
  bucket: number;
  accuracy: number;
}

interface MemoryInsights {
  successFactors: string[];
  failureFactors: string[];
}

interface MemoryResponse {
  symbol: string;
  total: number;
  correct: number;
  accuracy: number;
  insights: MemoryInsights;
  trend: TrendBucket[];
  recent: AIMemoryEntry[];
  time?: number;
}

const ACTION_BADGE: Record<
  PredictedAction,
  { label: string; cls: string }
> = {
  buy: {
    label: "BUY",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  sell: {
    label: "SELL",
    cls: "bg-red-500/10 text-red-400 border-red-500/30",
  },
  hold: {
    label: "HOLD",
    cls: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  },
  wait: {
    label: "WAIT",
    cls: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
};

function actionBadge(action: string) {
  return (
    ACTION_BADGE[(action as PredictedAction) ?? "hold"] ?? ACTION_BADGE.hold
  );
}

function accuracyColor(acc: number): string {
  if (acc >= 60) return "tt-text-up";
  if (acc >= 40) return "tt-text-accent";
  return "tt-text-down";
}

function accuracyBadgeClass(acc: number): string {
  if (acc >= 60)
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (acc >= 40)
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-red-500/10 text-red-400 border-red-500/30";
}

function OutcomeIcon({ outcome }: { outcome: ActualOutcome | "" }) {
  if (outcome === "up")
    return <ArrowUp className="w-3 h-3 tt-text-up" aria-label="up" />;
  if (outcome === "down")
    return <ArrowDown className="w-3 h-3 tt-text-down" aria-label="down" />;
  if (outcome === "flat")
    return <Minus className="w-3 h-3 tt-text-dim" aria-label="flat" />;
  return <span className="text-slate-600 text-[10px]">—</span>;
}

interface AIMemoryPanelProps {
  symbol: string;
}

export function AIMemoryPanel({ symbol }: AIMemoryPanelProps) {
  const [data, setData] = useState<MemoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await fetch(
          `/api/ai-memory/${encodeURIComponent(symbol.toUpperCase())}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as MemoryResponse;
        setData(json);
      } catch {
        if (!silent) toast.error("Failed to load AI memory");
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
    const id = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(id);
  }, [fetchData]);

  const trendBuckets = useMemo(() => {
    const all = data?.trend ?? [];
    return all.slice(-10);
  }, [data?.trend]);

  const recent = useMemo(
    () => (data?.recent ?? []).slice(0, 8),
    [data?.recent]
  );

  const accuracy = data?.accuracy ?? 0;
  const total = data?.total ?? 0;
  const correct = data?.correct ?? 0;
  const successFactors = data?.insights?.successFactors ?? [];
  const failureFactors = data?.insights?.failureFactors ?? [];

  const showEmpty = !loading && total < 4;

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-4 h-4 tt-text-accent shrink-0" />
          <span className="text-sm font-semibold">AI Memory</span>
          <span className="text-xs text-slate-500 truncate">
            · {symbol.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!loading && total >= 4 && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${accuracyBadgeClass(
                accuracy
              )}`}
            >
              {accuracy}%
            </span>
          )}
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
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <div className="p-3 space-y-3">
            <Skeleton className="h-20 w-full bg-white/5" />
            <Skeleton className="h-16 w-full bg-white/5" />
            <Skeleton className="h-24 w-full bg-white/5" />
          </div>
        ) : showEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Target className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
              Collecting predictions. Accuracy unlocks after 4+ resolved
              predictions.
            </p>
            <p className="text-[10px] text-slate-600 mt-2 tt-mono">
              {total} / 4 resolved
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Big accuracy display */}
            <div className="rounded-lg border border-white/5 bg-black/20 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Prediction Accuracy
              </div>
              <div className={`text-3xl font-bold tt-mono ${accuracyColor(accuracy)}`}>
                {accuracy}%
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                accurate over last{" "}
                <span className="tt-mono text-slate-300">{total}</span>{" "}
                predictions ·{" "}
                <span className="tt-mono tt-text-up">{correct}</span> correct
              </div>
            </div>

            {/* Trend mini chart */}
            {trendBuckets.length > 1 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                  Accuracy Trend
                </div>
                <AccuracyTrendChart buckets={trendBuckets} />
              </div>
            )}

            {/* Success + Failure factors */}
            <div className="grid grid-cols-1 gap-2">
              {successFactors.length > 0 && (
                <FactorList
                  title="Success Factors"
                  items={successFactors}
                  variant="success"
                />
              )}
              {failureFactors.length > 0 && (
                <FactorList
                  title="Failure Factors"
                  items={failureFactors}
                  variant="failure"
                />
              )}
              {successFactors.length === 0 &&
                failureFactors.length === 0 && (
                  <div className="rounded-lg border border-white/5 bg-black/20 p-2.5 text-[11px] text-slate-500">
                    Insights will be generated once more data accumulates.
                  </div>
                )}
            </div>

            {/* Recent predictions */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                Recent Predictions
              </div>
              <div className="space-y-1.5">
                {recent.map((p) => {
                  const ab = actionBadge(p.predictedAction);
                  const resolved = !!p.resolvedAt && p.actualOutcome !== "";
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border border-white/5 bg-black/20 p-2 hover:bg-black/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${ab.cls}`}
                        >
                          {ab.label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          conf{" "}
                          <span className="tt-mono text-slate-300">
                            {Math.round(p.predictedConfidence)}%
                          </span>
                        </span>
                        <span className="text-[9px] text-slate-600 ml-auto">
                          {relativeTime(p.createdAt)}
                        </span>
                      </div>
                      {resolved ? (
                        <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                          <span className="text-slate-500 uppercase tracking-wider text-[9px]">
                            Outcome
                          </span>
                          <span className="flex items-center gap-0.5">
                            <OutcomeIcon outcome={p.actualOutcome} />
                            <span className="text-slate-300">
                              {p.actualOutcome}
                            </span>
                          </span>
                          <span
                            className={`ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              p.correct
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/10 text-red-400 border-red-500/30"
                            }`}
                          >
                            {p.correct ? (
                              <>
                                <Check className="w-2.5 h-2.5" /> CORRECT
                              </>
                            ) : (
                              <>
                                <X className="w-2.5 h-2.5" /> WRONG
                              </>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-500">
                          <ArrowRight className="w-2.5 h-2.5" />
                          <span>Awaiting outcome…</span>
                        </div>
                      )}
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

function AccuracyTrendChart({ buckets }: { buckets: TrendBucket[] }) {
  const W = 280;
  const H = 70;
  const PAD = 6;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const points = buckets.map((b, i) => {
    const x =
      buckets.length === 1
        ? PAD
        : PAD + (i / (buckets.length - 1)) * innerW;
    const y = PAD + (1 - Math.max(0, Math.min(100, b.accuracy)) / 100) * innerH;
    return { x, y, acc: b.accuracy };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1].x.toFixed(2)} ${(
          PAD + innerH
        ).toFixed(2)} L${points[0].x.toFixed(2)} ${(PAD + innerH).toFixed(
          2
        )} Z`
      : "";

  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        className="block"
      >
        <defs>
          <linearGradient id="ai-mem-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 50% baseline */}
        <line
          x1={PAD}
          x2={W - PAD}
          y1={PAD + innerH / 2}
          y2={PAD + innerH / 2}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
        {areaPath && <path d={areaPath} fill="url(#ai-mem-grad)" />}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1.8}
            fill="#10b981"
            stroke="#07090d"
            strokeWidth={0.6}
          />
        ))}
      </svg>
      <div className="flex items-center justify-between mt-1 text-[9px] text-slate-600">
        <span>
          bucket {buckets[0]?.bucket}
          {buckets.length > 1 ? ` → ${buckets[buckets.length - 1]?.bucket}` : ""}
        </span>
        <span className="tt-mono">
          avg{" "}
          {Math.round(
            buckets.reduce((a, b) => a + b.accuracy, 0) / buckets.length
          )}
          %
        </span>
      </div>
    </div>
  );
}

function FactorList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "success" | "failure";
}) {
  const isOk = variant === "success";
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
        {title}
      </div>
      <ul className="space-y-1">
        {items.slice(0, 6).map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px]">
            {isOk ? (
              <Check className="w-3 h-3 tt-text-up mt-0.5 shrink-0" />
            ) : (
              <X className="w-3 h-3 tt-text-down mt-0.5 shrink-0" />
            )}
            <span className="text-slate-300 leading-snug">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AIMemoryPanel;
