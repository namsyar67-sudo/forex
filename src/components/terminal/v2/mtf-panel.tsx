"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Layers,
  Loader2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Trend = "Bullish" | "Bearish" | "Sideways";
type Signal = "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
type Bias = "bullish" | "bearish" | "neutral";
type Decision = "buy" | "sell" | "hold" | "wait";

interface TFResult {
  timeframe: string;
  trend: Trend;
  signal: Signal;
  confidence: number;
  riskScore: number;
  rsi: number;
  adx: number;
  bias: Bias;
  score: number; // -100..100
}

interface MTFOverall {
  decision: Decision;
  confidence: number;
  alignment: number; // 0..100
  trendBias: Bias;
  riskScore: number;
  summary: string;
}

interface MTFAnalysis {
  symbol: string;
  timeframes: TFResult[];
  overall: MTFOverall;
  weightedScore: number; // -100..100
}

interface MTFPanelProps {
  symbol: string;
}

const DECISION_STYLES: Record<Decision, { label: string; color: string; ring: string }> = {
  buy: { label: "BUY", color: "text-emerald-400", ring: "border-emerald-500/30 bg-emerald-500/[0.08]" },
  sell: { label: "SELL", color: "text-red-400", ring: "border-red-500/30 bg-red-500/[0.08]" },
  hold: { label: "HOLD", color: "text-slate-300", ring: "border-slate-500/30 bg-slate-500/[0.08]" },
  wait: { label: "WAIT", color: "text-amber-400", ring: "border-amber-500/30 bg-amber-500/[0.08]" },
};

const SIGNAL_BADGES: Record<Signal, string> = {
  STRONG_BUY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  BUY: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  NEUTRAL: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  SELL: "bg-red-500/10 text-red-400 border-red-500/20",
  STRONG_SELL: "bg-red-500/15 text-red-300 border-red-500/30",
};

function trendClass(trend: Trend): string {
  if (trend === "Bullish") return "tt-text-up";
  if (trend === "Bearish") return "tt-text-down";
  return "tt-text-dim";
}

function riskClass(score: number): string {
  if (score > 60) return "tt-text-down";
  if (score > 35) return "text-amber-400";
  return "tt-text-up";
}

function formatSignal(s: Signal): string {
  return s.replace(/_/g, " ");
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "Bullish") return <TrendingUp className="w-3 h-3" />;
  if (trend === "Bearish") return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

/**
 * ScoreBar — horizontal bar centred at 0.
 * Positive scores fill rightward (emerald), negative leftward (red).
 * Width is proportional to abs(score)/100 * 50% of the bar.
 */
function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.abs(score)) / 100; // 0..1
  const positive = score >= 0;
  return (
    <div className="relative h-1.5 rounded-full bg-black/40 overflow-hidden flex-1 min-w-0">
      {/* Centre marker */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
      <div
        className={`absolute top-0 bottom-0 ${positive ? "bg-emerald-500" : "bg-red-500"}`}
        style={{
          left: positive ? "50%" : `${50 - pct * 50}%`,
          width: `${pct * 50}%`,
        }}
      />
    </div>
  );
}

export function MTFPanel({ symbol }: MTFPanelProps) {
  const [analysis, setAnalysis] = useState<MTFAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await fetch(`/api/multi-timeframe/${symbol}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setAnalysis((data.analysis ?? null) as MTFAnalysis | null);
        setError(false);
      } catch {
        if (!silent) {
          setError(true);
          toast.error("Failed to load multi-timeframe analysis");
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
    fetchData(false);
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [fetchData, symbol]);

  const weightedScore = analysis?.weightedScore ?? 0;
  const scoreColor = weightedScore > 0 ? "tt-text-up" : weightedScore < 0 ? "tt-text-down" : "tt-text-dim";
  const scoreBadge =
    weightedScore > 0
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : weightedScore < 0
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">Multi-Timeframe Analysis</span>
          <span className="text-xs text-slate-500 truncate">· {symbol}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {analysis && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border tt-mono ${scoreBadge}`}
              title="Weighted score across all timeframes (-100..100)"
            >
              <span className="text-slate-500 uppercase tracking-wider">WS</span>
              <span className={scoreColor}>
                {weightedScore > 0 ? "+" : ""}
                {weightedScore}
              </span>
            </span>
          )}
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            title="Refresh"
            aria-label="Refresh multi-timeframe analysis"
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
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <MTFSkeleton />
        ) : error || !analysis ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed mb-3">
              Failed to load multi-timeframe analysis for {symbol}.
            </p>
            <button
              onClick={() => fetchData(false)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Overall decision card */}
            <OverallCard analysis={analysis} />

            {/* Timeframe breakdown */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 px-1">
                Timeframe Breakdown
              </div>
              <div className="space-y-1.5">
                {analysis.timeframes.length === 0 ? (
                  <div className="rounded-md border border-white/5 bg-black/20 px-3 py-4 text-center text-[11px] text-slate-500">
                    No timeframe data available.
                  </div>
                ) : (
                  analysis.timeframes.map((tf) => <TFRow key={tf.timeframe} tf={tf} />)
                )}
              </div>
            </div>

            {/* Summary */}
            {analysis.overall.summary && (
              <div className="rounded-md bg-white/[0.02] border border-white/5 p-2">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                  Summary
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {analysis.overall.summary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OverallCard({ analysis }: { analysis: MTFAnalysis }) {
  const style = DECISION_STYLES[analysis.overall.decision] ?? DECISION_STYLES.hold;
  const biasClass =
    analysis.overall.trendBias === "bullish"
      ? "tt-text-up"
      : analysis.overall.trendBias === "bearish"
      ? "tt-text-down"
      : "tt-text-dim";
  return (
    <div className={`rounded-lg border p-3 ${style.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
            Overall Decision
          </div>
          <div className={`text-2xl font-bold leading-none ${style.color}`}>
            {style.label}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Confidence</div>
          <div className="tt-mono text-sm text-slate-200">{analysis.overall.confidence}%</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <MiniStat label="Alignment" value={`${analysis.overall.alignment}%`} />
        <MiniStat
          label="Trend Bias"
          value={analysis.overall.trendBias}
          valueClass={biasClass}
        />
        <MiniStat
          label="Risk"
          value={`${analysis.overall.riskScore}`}
          valueClass={riskClass(analysis.overall.riskScore)}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md bg-black/30 px-2 py-1.5 border border-white/5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={`text-[11px] tt-mono capitalize ${
          valueClass ?? "text-slate-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function TFRow({ tf }: { tf: TFResult }) {
  const signalBadge = SIGNAL_BADGES[tf.signal] ?? SIGNAL_BADGES.NEUTRAL;
  const tc = trendClass(tf.trend);
  const rsiClass =
    tf.rsi < 30 ? "tt-text-up" : tf.rsi > 70 ? "tt-text-down" : "text-slate-200";
  const adxClass = tf.adx > 25 ? "tt-text-accent" : "text-slate-200";
  const scoreClass =
    tf.score > 0 ? "tt-text-up" : tf.score < 0 ? "tt-text-down" : "tt-text-dim";

  return (
    <div className="rounded-md border border-white/5 bg-black/20 px-2.5 py-2 hover:bg-black/30 transition-colors">
      {/* Top row: TF + trend + signal + score value */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] font-bold tt-mono text-slate-200 uppercase w-9 shrink-0">
          {tf.timeframe}
        </span>
        <span className={`flex items-center gap-0.5 text-[10px] ${tc} shrink-0`}>
          <TrendIcon trend={tf.trend} />
          <span>{tf.trend}</span>
        </span>
        <span
          className={`ml-auto text-[9px] px-1.5 py-0.5 rounded border tt-mono shrink-0 ${signalBadge}`}
        >
          {formatSignal(tf.signal)}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1.5 mb-1.5">
        <TFStat label="Conf" value={`${tf.confidence}%`} />
        <TFStat label="Risk" value={`${tf.riskScore}`} valueClass={riskClass(tf.riskScore)} />
        <TFStat label="RSI" value={tf.rsi.toFixed(0)} valueClass={rsiClass} />
        <TFStat label="ADX" value={`${tf.adx}`} valueClass={adxClass} />
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-wider text-slate-500 w-9 shrink-0">
          Score
        </span>
        <ScoreBar score={tf.score} />
        <span className={`text-[10px] tt-mono shrink-0 w-8 text-right ${scoreClass}`}>
          {tf.score > 0 ? "+" : ""}
          {tf.score}
        </span>
      </div>
    </div>
  );
}

function TFStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded bg-black/30 px-1.5 py-1 border border-white/5">
      <div className="text-[8px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-[10px] tt-mono ${valueClass ?? "text-slate-200"}`}>{value}</div>
    </div>
  );
}

function MTFSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <Skeleton className="h-24 w-full bg-white/5" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-32 bg-white/5" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full bg-white/5" />
        ))}
      </div>
    </div>
  );
}

export default MTFPanel;
