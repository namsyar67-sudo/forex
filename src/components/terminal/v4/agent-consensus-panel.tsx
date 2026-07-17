"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Network,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AgentRecommendation,
  ChiefDecision,
} from "@/lib/agents/types";
import { REC_BADGE, RecommendationBadge } from "./agent-reports-list";

interface ConsensusPanelProps {
  /** Optional callback when a row/pick is selected. */
  onSelect?: (symbol: string) => void;
}

interface DecisionSummary {
  symbol: string;
  recommendation: AgentRecommendation;
  confidence: number;
  qualityScore: number;
  direction: "long" | "short";
  consensus: {
    bullCount: number;
    bearCount: number;
    neutralCount: number;
    alignment: number;
  };
  summary: string;
}

interface ConsensusResponse {
  decisions: DecisionSummary[];
  topPicks: ChiefDecision[];
  count: number;
  time: number;
}

const REFRESH_MS = 60_000;

const DIRECTION_BADGE: Record<string, string> = {
  long: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  short: "bg-red-500/15 text-red-300 border-red-500/30",
};

type MetricTone = "neutral" | "up" | "down" | "accent";

function qualityColor(q: number): MetricTone {
  if (q >= 70) return "up";
  if (q >= 50) return "accent";
  return "down";
}

function qualityTextClass(q: number): string {
  if (q >= 70) return "tt-text-up";
  if (q >= 50) return "tt-text-accent";
  return "tt-text-down";
}

function qualityBarColor(q: number): string {
  if (q >= 70) return "bg-emerald-500";
  if (q >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function AgentConsensusPanel({ onSelect }: ConsensusPanelProps) {
  const [data, setData] = useState<ConsensusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/agents/decision?all=true`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ConsensusResponse;
      if (!json?.decisions) throw new Error("No decisions in response");
      setData(json);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      if (!silent) setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const id = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const decisions = data?.decisions ?? [];
  const sorted = [...decisions].sort((a, b) => b.qualityScore - a.qualityScore);
  const topPicks = (data?.topPicks ?? []).slice(0, 5);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Network className="w-4 h-4 text-violet-300 shrink-0" />
          <span className="text-sm font-semibold">Agent Consensus Scanner</span>
          <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
            · {data?.count ?? decisions.length} symbols
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchData(false)}
          disabled={refreshing}
          className="h-7 px-2 text-[11px] gap-1.5"
          title="Run Analysis"
        >
          {refreshing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          Run Analysis
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading && !data ? (
          <ConsensusSkeleton />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={() => fetchData(false)} />
        ) : (
          <div className="p-3 space-y-4">
            {/* Top Picks */}
            {topPicks.length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Top Picks</span>
                  <span className="text-slate-600">· ranked by quality</span>
                </div>
                <div className="space-y-1.5">
                  {topPicks.map((d, i) => (
                    <TopPickRow
                      key={d.symbol}
                      decision={d}
                      rank={i + 1}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Full table */}
            <section>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                <Network className="w-3 h-3" />
                <span>All Decisions</span>
                <span className="text-slate-600">· {sorted.length}</span>
              </div>
              <div className="rounded-lg border border-white/5 overflow-hidden">
                <DecisionTableHeader />
                <div className="divide-y divide-white/5">
                  {sorted.map((d) => (
                    <DecisionTableRow
                      key={d.symbol}
                      decision={d}
                      onSelect={onSelect}
                    />
                  ))}
                  {sorted.length === 0 && (
                    <div className="px-3 py-6 text-center text-[11px] text-slate-500">
                      No decisions available.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Top pick row (richer)
// ------------------------------------------------------------------

function TopPickRow({
  decision,
  rank,
  onSelect,
}: {
  decision: ChiefDecision;
  rank: number;
  onSelect?: (symbol: string) => void;
}) {
  const isLong = decision.direction === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const rec = decision.finalRecommendation;
  const rankTint =
    rank === 1
      ? "bg-amber-400/20 text-amber-300 border-amber-400/40"
      : rank === 2
      ? "bg-slate-300/15 text-slate-200 border-slate-300/40"
      : rank === 3
      ? "bg-orange-500/15 text-orange-300 border-orange-500/40"
      : "bg-white/5 text-slate-400 border-white/10";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(decision.symbol)}
      className="w-full text-left rounded-lg border border-white/5 bg-black/25 hover:bg-black/40 hover:border-white/10 transition-colors px-2.5 py-2"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-md text-[10px] font-bold tt-mono border ${rankTint}`}
        >
          {rank}
        </span>
        <span className="text-xs font-bold text-slate-100">
          {decision.symbol}
        </span>
        <RecommendationBadge rec={rec} />
        <span
          className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold uppercase border ${
            DIRECTION_BADGE[decision.direction]
          }`}
        >
          <DirectionIcon className="w-2.5 h-2.5" />
          {decision.direction}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <Metric label="Conf" value={`${Math.round(decision.unifiedConfidence)}%`} />
        <Metric
          label="Quality"
          value={`${Math.round(decision.qualityScore)}%`}
          tone={qualityColor(decision.qualityScore)}
        />
        <Metric
          label="Align"
          value={`${decision.consensus.alignment}%`}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-wider text-slate-500 w-14 shrink-0">
          Quality
        </span>
        <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden">
          <div
            className={qualityBarColor(decision.qualityScore)}
            style={{
              width: `${Math.min(100, Math.max(0, decision.qualityScore))}%`,
            }}
          />
        </div>
      </div>
    </button>
  );
}

// ------------------------------------------------------------------
// Decision table
// ------------------------------------------------------------------

function DecisionTableHeader() {
  return (
    <div className="grid grid-cols-[64px_56px_52px_52px_56px_84px_48px] gap-2 px-2.5 py-1.5 bg-white/[0.03] text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
      <span>Symbol</span>
      <span>Rec</span>
      <span className="text-right">Conf</span>
      <span className="text-right">Qual</span>
      <span>Dir</span>
      <span>B/N/B</span>
      <span className="text-right">Align</span>
    </div>
  );
}

function DecisionTableRow({
  decision,
  onSelect,
}: {
  decision: DecisionSummary;
  onSelect?: (symbol: string) => void;
}) {
  const isLong = decision.direction === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const recCls = REC_BADGE[decision.recommendation];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(decision.symbol)}
      className="w-full text-left grid grid-cols-[64px_56px_52px_52px_56px_84px_48px] gap-2 px-2.5 py-1.5 hover:bg-white/[0.03] transition-colors items-center text-[10px]"
    >
      <span className="text-slate-100 font-semibold truncate">
        {decision.symbol}
      </span>
      <span
        className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-[9px] font-bold uppercase border ${recCls}`}
      >
        {decision.recommendation}
      </span>
      <span className="text-right tt-mono text-slate-300">
        {Math.round(decision.confidence)}%
      </span>
      <span className={`text-right tt-mono font-medium ${qualityTextClass(decision.qualityScore)}`}>
        {Math.round(decision.qualityScore)}%
      </span>
      <span
        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold uppercase border w-fit ${
          DIRECTION_BADGE[decision.direction]
        }`}
      >
        <DirectionIcon className="w-2.5 h-2.5" />
        {decision.direction === "long" ? "L" : "S"}
      </span>
      <span className="tt-mono text-slate-400">
        <span className="tt-text-up">{decision.consensus.bullCount}</span>
        <span className="text-slate-600">/</span>
        <span className="tt-text-dim">{decision.consensus.neutralCount}</span>
        <span className="text-slate-600">/</span>
        <span className="tt-text-down">{decision.consensus.bearCount}</span>
      </span>
      <span className="text-right tt-mono text-slate-300">
        {decision.consensus.alignment}%
      </span>
    </button>
  );
}

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "up" | "down" | "accent";
}) {
  const color =
    tone === "up"
      ? "tt-text-up"
      : tone === "down"
      ? "tt-text-down"
      : tone === "accent"
      ? "tt-text-accent"
      : "text-slate-200";
  return (
    <div className="rounded-md bg-black/30 px-1.5 py-1 border border-white/5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`tt-mono text-[11px] font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 gap-3">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <div>
        <p className="text-sm text-slate-200 font-medium">
          Consensus scan failed
        </p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-[280px]">
          {message}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="h-8 text-xs gap-1.5"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </Button>
    </div>
  );
}

function ConsensusSkeleton() {
  return (
    <div className="p-3 space-y-4">
      {/* Top picks skeleton */}
      <div>
        <Skeleton className="h-3 w-28 mb-2 bg-white/5" />
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/5 bg-black/25 px-2.5 py-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded-md bg-white/5" />
                <Skeleton className="h-3 w-16 bg-white/5" />
                <Skeleton className="h-4 w-12 ml-auto bg-white/5" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-7 w-full bg-white/5" />
                <Skeleton className="h-7 w-full bg-white/5" />
                <Skeleton className="h-7 w-full bg-white/5" />
              </div>
              <Skeleton className="h-1 w-full bg-white/5" />
            </div>
          ))}
        </div>
      </div>
      {/* Table skeleton */}
      <div>
        <Skeleton className="h-3 w-24 mb-2 bg-white/5" />
        <div className="rounded-lg border border-white/5 overflow-hidden">
          <Skeleton className="h-6 w-full bg-white/5" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border-t border-white/5 px-2.5 py-1.5 flex items-center gap-2"
            >
              <Skeleton className="h-3 w-12 bg-white/5" />
              <Skeleton className="h-4 w-10 bg-white/5" />
              <Skeleton className="h-3 w-8 ml-auto bg-white/5" />
              <Skeleton className="h-3 w-8 bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AgentConsensusPanel;
