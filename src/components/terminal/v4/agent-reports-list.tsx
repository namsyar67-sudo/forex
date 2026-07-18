"use client";

import {
  Activity,
  Brain,
  Cpu,
  Gauge,
  Layers,
  Network,
  Newspaper,
  Shield,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  AgentFactor,
  AgentRecommendation,
  AgentReport,
  AgentType,
} from "@/lib/agents/types";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/**
 * View-shaped agent report — same as AgentReport but with an optional
 * friendly `name` field. The backend implementation does not always
 * populate `name`, so we derive a sensible default from the agent type
 * (and, for the duplicate "technical" type, from the report's data).
 */
export type AgentReportView = AgentReport & {
  name?: string;
};

// ------------------------------------------------------------------
// Recommendation styling
// ------------------------------------------------------------------

export const REC_BADGE: Record<AgentRecommendation, string> = {
  BUY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  SELL: "bg-red-500/15 text-red-300 border-red-500/40",
  HOLD: "bg-slate-500/15 text-slate-300 border-slate-500/40",
  WAIT: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

export const REC_TEXT: Record<AgentRecommendation, string> = {
  BUY: "tt-text-up",
  SELL: "tt-text-down",
  HOLD: "tt-text-dim",
  WAIT: "tt-text-accent",
};

// ------------------------------------------------------------------
// Agent type metadata
// ------------------------------------------------------------------

export interface AgentMeta {
  name: string;
  shortName: string;
  type: AgentType;
  icon: LucideIcon;
  /** Tailwind text color class for the icon. */
  color: string;
  description: string;
}

const AGENT_META_BY_TYPE: Record<AgentType, AgentMeta> = {
  chief: {
    name: "Chief AI Agent",
    shortName: "Chief",
    type: "chief",
    icon: Brain,
    color: "text-violet-300",
    description: "Orchestrates agents and issues the final decision.",
  },
  technical: {
    name: "Technical Analysis Agent",
    shortName: "Technical",
    type: "technical",
    icon: TrendingUp,
    color: "text-sky-300",
    description: "Reads chart structure, momentum, and trend.",
  },
  news: {
    name: "News Analysis Agent",
    shortName: "News",
    type: "news",
    icon: Newspaper,
    color: "text-amber-300",
    description: "Scores macro news and headline risk.",
  },
  sentiment: {
    name: "Sentiment Analysis Agent",
    shortName: "Sentiment",
    type: "sentiment",
    icon: Activity,
    color: "text-pink-300",
    description: "Currency strength and crowd positioning.",
  },
  risk: {
    name: "Risk Management Agent",
    shortName: "Risk",
    type: "risk",
    icon: Shield,
    color: "text-rose-300",
    description: "Sizes risk, vol, liquidity, and spread.",
  },
  execution: {
    name: "Execution Agent",
    shortName: "Execution",
    type: "execution",
    icon: Zap,
    color: "text-yellow-300",
    description: "Assesses slippage and execution conditions.",
  },
  monitor: {
    name: "Trade Monitor Agent",
    shortName: "Monitor",
    type: "monitor",
    icon: Gauge,
    color: "text-teal-300",
    description: "Tracks open positions for exit signals.",
  },
  learning: {
    name: "Learning Agent",
    shortName: "Learning",
    type: "learning",
    icon: Cpu,
    color: "text-cyan-300",
    description: "Updates priors from past trade outcomes.",
  },
  backtesting: {
    name: "Backtesting Agent",
    shortName: "Backtest",
    type: "backtesting",
    icon: Layers,
    color: "text-indigo-300",
    description: "Validates the strategy against history.",
  },
  portfolio: {
    name: "Portfolio Agent",
    shortName: "Portfolio",
    type: "portfolio",
    icon: Network,
    color: "text-emerald-300",
    description: "Checks diversification and correlation.",
  },
};

/**
 * Two agents share `agent: "technical"` (the Technical Analysis Agent
 * and the Smart Money Agent). Disambiguate by inspecting the report's
 * data payload / summary — the Smart Money agent emits a `bias` field
 * and references SMC concepts in its summary.
 */
function detectTechnicalVariant(report: AgentReportView): AgentMeta {
  const data = (report.data ?? {}) as Record<string, unknown>;
  const looksLikeSmartMoney =
    data.bias !== undefined ||
    data.activeOBs !== undefined ||
    data.activeFVGs !== undefined ||
    /SMC|smart money|order block/i.test(report.summary || "");

  if (looksLikeSmartMoney) {
    return {
      ...AGENT_META_BY_TYPE.technical,
      name: "Smart Money Agent",
      shortName: "Smart Money",
      icon: Network,
      color: "text-violet-300",
      description: "ICT / SMC structure, order blocks, FVGs, liquidity.",
    };
  }
  return AGENT_META_BY_TYPE.technical;
}

export function getAgentMeta(report: AgentReportView): AgentMeta {
  const explicit = report.name?.trim();
  if (explicit) {
    const base = AGENT_META_BY_TYPE[report.agent] ?? AGENT_META_BY_TYPE.technical;
    return { ...base, name: explicit, shortName: explicit };
  }
  if (report.agent === "technical") return detectTechnicalVariant(report);
  return AGENT_META_BY_TYPE[report.agent] ?? AGENT_META_BY_TYPE.technical;
}

// ------------------------------------------------------------------
// Small primitives (exported for reuse)
// ------------------------------------------------------------------

/** Bipolar score bar from -100..100, centered at 0. */
export function ScoreBar({ score }: { score: number }) {
  const v = Math.max(-100, Math.min(100, score));
  const isPositive = v >= 0;
  const widthPct = Math.abs(v) / 2; // half-width because bar is split
  return (
    <div className="relative h-1.5 rounded-full bg-black/50 overflow-hidden">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/25 z-10" />
      {isPositive ? (
        <div
          className="absolute top-0 bottom-0 left-1/2 bg-gradient-to-r from-emerald-600 to-emerald-400"
          style={{ width: `${widthPct}%` }}
        />
      ) : (
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-l from-red-600 to-red-400"
          style={{ right: "50%", width: `${widthPct}%` }}
        />
      )}
    </div>
  );
}

export function RecommendationBadge({
  rec,
  size = "sm",
}: {
  rec: AgentRecommendation;
  size?: "sm" | "md" | "lg";
}) {
  const cls = REC_BADGE[rec];
  const sizeCls =
    size === "lg"
      ? "px-3 py-1 text-sm"
      : size === "md"
      ? "px-2 py-0.5 text-xs"
      : "px-1.5 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-bold uppercase tracking-wide ${cls} ${sizeCls}`}
    >
      {rec}
    </span>
  );
}

function FactorChip({ factor }: { factor: AgentFactor }) {
  const tone =
    factor.impact === "positive"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
      : factor.impact === "negative"
      ? "bg-red-500/10 text-red-300 border-red-500/25"
      : "bg-slate-500/10 text-slate-300 border-slate-500/25";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border ${tone} leading-tight max-w-full truncate`}
      title={`${factor.name}: ${factor.value} (${factor.impact})`}
    >
      <span className="opacity-70">
        {factor.impact === "positive"
          ? "▲"
          : factor.impact === "negative"
          ? "▼"
          : "■"}
      </span>
      <span className="font-medium">{factor.name}:</span>
      <span className="opacity-80 truncate">{factor.value}</span>
    </span>
  );
}

// ------------------------------------------------------------------
// Main presentational component
// ------------------------------------------------------------------

interface AgentReportsListProps {
  reports: AgentReport[];
  /** Optional max number of factors to render per report (default: all). */
  maxFactors?: number;
  /** Compact mode hides the summary text. */
  compact?: boolean;
}

export function AgentReportsList({
  reports,
  maxFactors,
  compact = false,
}: AgentReportsListProps) {
  if (!reports || reports.length === 0) {
    return (
      <div className="text-[11px] text-slate-500 italic px-3 py-6 text-center">
        No agent reports available.
      </div>
    );
  }

  // Sort by absolute contribution weight descending so the most
  // influential agents surface to the top.
  const sorted = [...reports].sort(
    (a, b) => (b.weight ?? 0) - (a.weight ?? 0)
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {sorted.map((r, i) => (
        <AgentReportCard
          key={`${r.agent}-${i}`}
          report={r as AgentReportView}
          maxFactors={maxFactors}
          compact={compact}
        />
      ))}
    </div>
  );
}

function AgentReportCard({
  report,
  maxFactors,
  compact,
}: {
  report: AgentReportView;
  maxFactors?: number;
  compact: boolean;
}) {
  const meta = getAgentMeta(report);
  const Icon = meta.icon;
  const factors = maxFactors
    ? report.factors.slice(0, maxFactors)
    : report.factors;
  const confidenceColor =
    report.confidence >= 70
      ? "tt-text-up"
      : report.confidence >= 45
      ? "tt-text-accent"
      : "tt-text-down";

  return (
    <div className="rounded-lg border border-white/5 bg-black/25 p-2.5 flex flex-col gap-2 hover:border-white/10 transition-colors">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div
          className={`shrink-0 w-7 h-7 rounded-md bg-white/5 flex items-center justify-center ${meta.color}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-100 truncate">
            {meta.name}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            {report.agent} · weight {(report.weight ?? 0).toFixed(2)}
          </div>
        </div>
        <RecommendationBadge rec={report.recommendation} />
      </div>

      {/* Confidence + Score row */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            Confidence
          </div>
          <div className={`tt-mono text-sm font-bold ${confidenceColor}`}>
            {Math.round(report.confidence)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5 flex items-center justify-between">
            <span>Score</span>
            <span className="tt-mono text-slate-300">
              {report.score > 0 ? "+" : ""}
              {Math.round(report.score)}
            </span>
          </div>
          <ScoreBar score={report.score} />
        </div>
      </div>

      {/* Weight contribution bar */}
      <div>
        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5 flex items-center justify-between">
          <span>Contribution</span>
          <span className="tt-mono text-slate-400">
            {Math.round((report.weight ?? 0) * 100)}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-black/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-600 to-violet-500"
            style={{ width: `${Math.min(100, (report.weight ?? 0) * 100)}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      {!compact && report.summary && (
        <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">
          {report.summary}
        </p>
      )}

      {/* Factors */}
      {factors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {factors.map((f, i) => (
            <FactorChip key={`${f.name}-${i}`} factor={f} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentReportsList;
