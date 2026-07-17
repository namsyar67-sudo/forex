"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  Loader2,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ChiefDecision, AgentRecommendation } from "@/lib/agents/types";
import { formatPrice } from "@/lib/format";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";
import {
  AgentReportsList,
  REC_BADGE,
  REC_TEXT,
  RecommendationBadge,
} from "./agent-reports-list";

interface MultiAgentPanelProps {
  symbol: string;
}

interface DecisionResponse {
  decision: ChiefDecision;
  time: number;
}

const REFRESH_MS = 30_000;

// Recommendation-driven gradient for the chief card border.
const REC_GRADIENT: Record<AgentRecommendation, string> = {
  BUY: "from-emerald-500/60 via-teal-400/40 to-sky-500/50",
  SELL: "from-red-500/60 via-rose-400/40 to-orange-500/50",
  HOLD: "from-slate-500/50 via-slate-400/30 to-zinc-500/40",
  WAIT: "from-amber-500/60 via-amber-400/40 to-orange-500/50",
};

const RISK_BADGE: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  extreme: "bg-red-500/20 text-red-300 border-red-500/40",
};

export function MultiAgentPanel({ symbol }: MultiAgentPanelProps) {
  const [data, setData] = useState<DecisionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const sym = symbol.toUpperCase();
  const digits = INSTRUMENT_MAP[sym]?.digits ?? 5;

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setRefreshing(true);
        setError(null);
      }
      try {
        const res = await fetch(
          `/api/agents/decision?symbol=${encodeURIComponent(sym)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DecisionResponse;
        if (!json?.decision) throw new Error("No decision in response");
        setData(json);
        setError(null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load";
        if (!silent) setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sym]
  );

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    fetchData(false);
    const id = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative inline-flex">
            <Brain
              className={`w-4 h-4 text-violet-300 ${
                refreshing ? "animate-pulse" : "tt-pulse-dot"
              }`}
            />
          </span>
          <span className="text-sm font-semibold">Multi-Agent AI</span>
          <span className="text-xs text-slate-500 truncate">· {sym}</span>
        </div>
        <button
          onClick={() => fetchData(false)}
          disabled={refreshing}
          className="text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors p-1"
          aria-label="Refresh"
          title="Refresh decision"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading && !data ? (
          <MultiAgentSkeleton />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={() => fetchData(false)} />
        ) : data ? (
          <DecisionBody
            decision={data.decision}
            digits={digits}
            reasoningOpen={reasoningOpen}
            onToggleReasoning={() => setReasoningOpen((o) => !o)}
          />
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Decision body
// ------------------------------------------------------------------

function DecisionBody({
  decision,
  digits,
  reasoningOpen,
  onToggleReasoning,
}: {
  decision: ChiefDecision;
  digits: number;
  reasoningOpen: boolean;
  onToggleReasoning: () => void;
}) {
  return (
    <div className="p-3 space-y-3">
      {/* Chief Decision Card (gradient border) */}
      <ChiefDecisionCard decision={decision} digits={digits} />

      {/* Agent Reports Grid */}
      <section>
        <SectionLabel
          icon={<Brain className="w-3 h-3" />}
          label={`Agent Reports (${decision.reports.length})`}
        />
        <AgentReportsList reports={decision.reports} maxFactors={3} />
      </section>

      {/* Full Reasoning */}
      <Collapsible open={reasoningOpen} onOpenChange={onToggleReasoning}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors">
            <SectionLabel
              icon={<Target className="w-3 h-3" />}
              label="Full Reasoning"
            />
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                reasoningOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 rounded-md bg-black/40 border border-white/5 p-3 text-[10.5px] leading-relaxed text-slate-300 whitespace-pre-wrap font-mono tt-mono overflow-x-auto">
            {decision.reasoning || "—"}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ------------------------------------------------------------------
// Chief decision card
// ------------------------------------------------------------------

function ChiefDecisionCard({
  decision,
  digits,
}: {
  decision: ChiefDecision;
  digits: number;
}) {
  const rec = decision.finalRecommendation;
  const gradient = REC_GRADIENT[rec];
  const recTextCls = REC_TEXT[rec];
  const isLong = decision.direction === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;

  return (
    <div
      className={`rounded-xl p-px bg-gradient-to-r ${gradient} shadow-[0_0_22px_-10px_rgba(255,255,255,0.15)]`}
    >
      <div className="rounded-[11px] bg-black/50 p-3 space-y-3">
        {/* Top row: recommendation + direction */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-300" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">
                Chief Decision
              </div>
              <div className="text-[10px] text-slate-400">{decision.symbol}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                isLong
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  : "bg-red-500/15 text-red-300 border-red-500/40"
              }`}
            >
              <DirectionIcon className="w-2.5 h-2.5" />
              {decision.direction}
            </span>
          </div>
        </div>

        {/* Big recommendation badge */}
        <div className="flex items-center justify-between">
          <RecommendationBadge rec={rec} size="lg" />
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">
              Unified Confidence
            </div>
            <div className={`tt-mono text-2xl font-bold ${recTextCls}`}>
              {Math.round(decision.unifiedConfidence)}%
            </div>
          </div>
        </div>

        {/* Quality score (circular) + consensus */}
        <div className="grid grid-cols-2 gap-3 items-center">
          <div className="flex items-center gap-2.5">
            <CircularProgress
              value={decision.qualityScore}
              color="#14b8a6"
              size={48}
            />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">
                Quality Score
              </div>
              <div className="tt-mono text-sm font-bold text-teal-300">
                {Math.round(decision.qualityScore)}%
              </div>
            </div>
          </div>
          <ConsensusBlock consensus={decision.consensus} />
        </div>

        {/* Trade setup grid */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Trade Setup
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <SetupItem label="Entry" value={formatPrice(decision.entryPrice, digits)} tone="accent" />
            <SetupItem label="Stop Loss" value={formatPrice(decision.stopLoss, digits)} tone="down" />
            <SetupItem label="TP1" value={formatPrice(decision.takeProfit1, digits)} tone="up" />
            <SetupItem label="TP2" value={formatPrice(decision.takeProfit2, digits)} tone="up" />
            <SetupItem label="TP3" value={formatPrice(decision.takeProfit3, digits)} tone="up" />
            <SetupItem
              label="R / R"
              value={decision.riskReward.toFixed(2)}
              tone="neutral"
            />
            <div className="col-span-2">
              <SetupItem
                label="Risk Level"
                value={decision.riskLevel.toUpperCase()}
                tone="badge"
                badgeCls={RISK_BADGE[decision.riskLevel] ?? RISK_BADGE.medium}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Consensus block (3 segments + alignment)
// ------------------------------------------------------------------

function ConsensusBlock({
  consensus,
}: {
  consensus: ChiefDecision["consensus"];
}) {
  const total =
    consensus.bullCount + consensus.bearCount + consensus.neutralCount || 1;
  const bullPct = (consensus.bullCount / total) * 100;
  const bearPct = (consensus.bearCount / total) * 100;
  const neutralPct = (consensus.neutralCount / total) * 100;

  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
        <span>Consensus</span>
        <span className="tt-mono text-slate-300">
          {consensus.alignment}% align
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-black/50">
        <div
          className="bg-emerald-500"
          style={{ width: `${bullPct}%` }}
          title={`${consensus.bullCount} bull`}
        />
        <div
          className="bg-slate-500"
          style={{ width: `${neutralPct}%` }}
          title={`${consensus.neutralCount} neutral`}
        />
        <div
          className="bg-red-500"
          style={{ width: `${bearPct}%` }}
          title={`${consensus.bearCount} bear`}
        />
      </div>
      <div className="flex items-center justify-between mt-1 text-[9px]">
        <span className="tt-text-up">{consensus.bullCount} bull</span>
        <span className="tt-text-dim">{consensus.neutralCount} neut</span>
        <span className="tt-text-down">{consensus.bearCount} bear</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Trade setup item
// ------------------------------------------------------------------

function SetupItem({
  label,
  value,
  tone,
  badgeCls,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "accent" | "neutral" | "badge";
  badgeCls?: string;
}) {
  const valColor =
    tone === "up"
      ? "tt-text-up"
      : tone === "down"
      ? "tt-text-down"
      : tone === "accent"
      ? "tt-text-accent"
      : "text-slate-200";
  return (
    <div className="rounded-md bg-black/30 px-2 py-1.5 border border-white/5">
      <div className="text-[9px] text-slate-500 uppercase tracking-wider">
        {label}
      </div>
      {tone === "badge" ? (
        <span
          className={`inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
            badgeCls ?? ""
          }`}
        >
          {value}
        </span>
      ) : (
        <div className={`text-[11px] tt-mono font-medium ${valColor}`}>
          {value}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Circular progress (SVG ring)
// ------------------------------------------------------------------

function CircularProgress({
  value,
  size = 44,
  stroke = 4,
  color = "#10b981",
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Quality ${Math.round(v)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tt-mono text-teal-200">
        {Math.round(v)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Section label + error/loading states
// ------------------------------------------------------------------

function SectionLabel({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 mb-2 px-0.5">
      {icon}
      <span>{label}</span>
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
          Agent decision failed
        </p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-[280px]">
          {message}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry} className="h-8 text-xs gap-1.5">
        <RefreshCw className="w-3 h-3" />
        Retry
      </Button>
    </div>
  );
}

function MultiAgentSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {/* Chief card skeleton */}
      <div className="rounded-xl p-px bg-white/5">
        <div className="rounded-[11px] bg-black/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28 bg-white/5" />
            <Skeleton className="h-7 w-14 bg-white/5" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-20 bg-white/5" />
            <Skeleton className="h-8 w-16 bg-white/5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-12 w-full bg-white/5" />
            <Skeleton className="h-12 w-full bg-white/5" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full bg-white/5" />
            ))}
          </div>
        </div>
      </div>
      {/* Agent reports grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-white/5 bg-black/25 p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="w-7 h-7 rounded-md bg-white/5" />
              <Skeleton className="h-3 w-24 bg-white/5" />
              <Skeleton className="h-4 w-10 ml-auto bg-white/5" />
            </div>
            <Skeleton className="h-1.5 w-full bg-white/5" />
            <Skeleton className="h-3 w-full bg-white/5" />
            <div className="flex gap-1">
              <Skeleton className="h-3 w-16 bg-white/5" />
              <Skeleton className="h-3 w-20 bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MultiAgentPanel;
