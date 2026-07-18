"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileSearch,
  History,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";

// ---------- Types ----------

type Decision = "BUY" | "SELL" | "HOLD" | "WAIT";
type Outcome = "win" | "loss" | "expired" | "invalidated" | "still_active" | null;

interface AuditSummary {
  id: string;
  signalId: string | null;
  symbol: string;
  decision: string;
  confidence: number;
  qualityScore: number;
  direction: string;
  outcomeTracked: boolean;
  finalOutcome: Outcome;
  outcomePnl: number | null;
  confidenceChange: number | null;
  totalLatency: number | null;
  processingLatency: number | null;
  notificationLatency: number | null;
  decisionTime: string;
  resolvedAt: string | null;
  reasoningPreview: string;
}

interface AuditStats {
  total: number;
  resolved: number;
  winRate: number;
  avgConfidence: number;
  avgLatency: number;
  byDecision: Record<string, number>;
  byOutcome: Record<string, number>;
  recentTrend: { date: string; count: number; winRate: number }[];
}

interface ListResponse {
  audits: AuditSummary[];
  count: number;
  time: number;
}

interface StatsResponse {
  stats: AuditStats;
  time: number;
}

interface AuditPanelProps {
  onSelectAudit?: (id: string) => void;
}

const REFRESH_MS = 30_000;

// ---------- Decision & outcome styling ----------

const DECISION_BADGE: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  SELL: "bg-red-500/15 text-red-400 border-red-500/30",
  HOLD: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  WAIT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const OUTCOME_BADGE: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
  win: {
    class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: <CheckCircle className="w-2.5 h-2.5" />,
    label: "WIN",
  },
  loss: {
    class: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: <XCircle className="w-2.5 h-2.5" />,
    label: "LOSS",
  },
  expired: {
    class: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    icon: <Clock className="w-2.5 h-2.5" />,
    label: "EXPIRED",
  },
  invalidated: {
    class: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: <AlertTriangle className="w-2.5 h-2.5" />,
    label: "INVALID",
  },
  still_active: {
    class: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    icon: <Activity className="w-2.5 h-2.5" />,
    label: "ACTIVE",
  },
};

type FilterKey = "all" | "unresolved" | "wins" | "losses";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unresolved", label: "Unresolved" },
  { key: "wins", label: "Wins" },
  { key: "losses", label: "Losses" },
];

// ---------- Helpers ----------

function latencyColor(ms: number | null): string {
  if (ms === null || ms === undefined) return "text-slate-500";
  if (ms < 1000) return "tt-text-up";
  if (ms < 5000) return "tt-text-accent";
  return "tt-text-down";
}

function latencyFormat(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function pnlColor(v: number | null): string {
  if (v === null || v === undefined) return "text-slate-500";
  if (v > 0) return "tt-text-up";
  if (v < 0) return "tt-text-down";
  return "tt-text-dim";
}

function signedPnl(v: number | null): string {
  if (v === null || v === undefined) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(2)}`;
}

function confidenceChangeRender(change: number | null): React.ReactNode {
  if (change === null || change === undefined || change === 0) {
    return <span className="tt-mono text-[10px] text-slate-500">±0%</span>;
  }
  const positive = change > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? "tt-text-up" : "tt-text-down";
  return (
    <span className={`inline-flex items-center gap-0.5 tt-mono text-[10px] ${color}`}>
      <Icon className="w-2.5 h-2.5" />
      {positive ? "+" : ""}
      {change.toFixed(0)}%
    </span>
  );
}

function qualityColor(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function confidenceColor(c: number): string {
  if (c >= 80) return "tt-text-up";
  if (c >= 60) return "tt-text-accent";
  return "tt-text-dim";
}

// ---------- Component ----------

export function AuditPanel({ onSelectAudit }: AuditPanelProps) {
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
      setError(null);
    }
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch("/api/audit?limit=50", { cache: "no-store" }),
        fetch("/api/audit?stats=true", { cache: "no-store" }),
      ]);
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      if (!statsRes.ok) throw new Error(`HTTP ${statsRes.status}`);
      const listJson = (await listRes.json()) as ListResponse;
      const statsJson = (await statsRes.json()) as StatsResponse;
      setAudits(listJson.audits || []);
      setStats(statsJson.stats || null);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load audits";
      if (!silent) setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(() => fetchAll(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleResolveOld = useCallback(async () => {
    setResolving(true);
    try {
      const res = await fetch("/api/audit/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { resolved: number };
      toast.success(`Resolved ${json.resolved || 0} old audit(s)`);
      await fetchAll(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to resolve old audits";
      toast.error(msg);
    } finally {
      setResolving(false);
    }
  }, [fetchAll]);

  // Client-side filter (data is already loaded)
  const visibleAudits = audits.filter((a) => {
    switch (filter) {
      case "unresolved":
        return !a.outcomeTracked;
      case "wins":
        return a.finalOutcome === "win";
      case "losses":
        return a.finalOutcome === "loss";
      default:
        return true;
    }
  });

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-slate-400 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-100 truncate">Decision Audit</h2>
          <span className="tt-mono text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
            {audits.length}
          </span>
          {refreshing && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResolveOld}
          disabled={resolving}
          className="h-7 text-[11px] gap-1.5"
        >
          {resolving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          Resolve Old
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <PanelSkeleton />
        ) : error ? (
          <PanelError error={error} onRetry={() => fetchAll()} />
        ) : (
          <div className="p-3 space-y-3">
            {/* Stats row */}
            <StatsRow stats={stats} />

            {/* Breakdowns */}
            <Breakdowns stats={stats} />

            {/* Filter buttons */}
            <div className="flex items-center gap-1">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors border ${
                      active
                        ? "bg-white/10 text-slate-100 border-white/20"
                        : "bg-transparent text-slate-500 border-white/5 hover:text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
              <span className="ml-auto tt-mono text-[10px] text-slate-500">
                {visibleAudits.length} shown
              </span>
            </div>

            {/* Audit list */}
            {visibleAudits.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              <div className="space-y-1.5">
                {visibleAudits.map((a) => (
                  <AuditRow
                    key={a.id}
                    audit={a}
                    onClick={() => onSelectAudit?.(a.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

function StatsRow({ stats }: { stats: AuditStats | null }) {
  const items: { label: string; value: string; sub?: string; icon: React.ReactNode }[] = [
    {
      label: "Total",
      value: stats ? String(stats.total) : "—",
      icon: <History className="w-3 h-3" />,
    },
    {
      label: "Resolved",
      value: stats ? String(stats.resolved) : "—",
      icon: <CheckCircle className="w-3 h-3" />,
    },
    {
      label: "Win Rate",
      value: stats ? `${stats.winRate}%` : "—",
      icon: <Target className="w-3 h-3" />,
    },
    {
      label: "Avg Conf",
      value: stats ? `${stats.avgConfidence}%` : "—",
      icon: <Activity className="w-3 h-3" />,
    },
    {
      label: "Avg Latency",
      value: stats ? (stats.avgLatency >= 1000 ? `${(stats.avgLatency / 1000).toFixed(1)}s` : `${stats.avgLatency}ms`) : "—",
      icon: <Clock className="w-3 h-3" />,
    },
  ];
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5"
        >
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
            <span className="text-slate-500">{it.icon}</span>
            {it.label}
          </div>
          <div className="tt-mono text-sm font-bold text-slate-100 truncate">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Breakdowns({ stats }: { stats: AuditStats | null }) {
  const decisionKeys = ["BUY", "SELL", "WAIT", "HOLD"];
  const outcomeKeys = ["win", "loss", "expired", "invalidated", "still_active"];

  return (
    <div className="space-y-2">
      {/* By decision */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          By Decision
        </div>
        <div className="flex flex-wrap gap-1">
          {decisionKeys.map((k) => {
            const count = stats?.byDecision?.[k] ?? 0;
            return (
              <span
                key={k}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${DECISION_BADGE[k] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}
              >
                {k}
                <span className="tt-mono">{count}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* By outcome */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          By Outcome
        </div>
        <div className="flex flex-wrap gap-1">
          {outcomeKeys.map((k) => {
            const count = stats?.byOutcome?.[k] ?? 0;
            const meta = OUTCOME_BADGE[k];
            if (!meta) return null;
            return (
              <span
                key={k}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${meta.class}`}
              >
                {meta.icon}
                {meta.label}
                <span className="tt-mono">{count}</span>
              </span>
            );
          })}
          {stats && (stats.byOutcome?.unresolved ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border bg-slate-500/10 text-slate-400 border-slate-500/20">
              <Clock className="w-2.5 h-2.5" />
              PENDING
              <span className="tt-mono">{stats.byOutcome.unresolved}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditRow({
  audit,
  onClick,
}: {
  audit: AuditSummary;
  onClick: () => void;
}) {
  const decision = (audit.decision || "HOLD").toUpperCase();
  const decisionClass =
    DECISION_BADGE[decision] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30";
  const isLong = (audit.direction || "").toLowerCase() === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const outcomeMeta = audit.finalOutcome ? OUTCOME_BADGE[audit.finalOutcome] : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md border border-white/5 bg-black/20 hover:bg-black/30 hover:border-white/10 transition-colors p-2 group"
    >
      <div className="flex items-center gap-2 flex-wrap">
        {/* Symbol + decision */}
        <span className="text-xs font-bold text-slate-100 tt-mono">
          {audit.symbol}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${decisionClass}`}
        >
          {decision}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold uppercase border ${
            isLong
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}
        >
          <DirectionIcon className="w-2.5 h-2.5" />
          {audit.direction?.toUpperCase() || "—"}
        </span>

        {/* Outcome badge */}
        {outcomeMeta && (
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${outcomeMeta.class}`}
          >
            {outcomeMeta.icon}
            {outcomeMeta.label}
          </span>
        )}

        {/* Time */}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
          <Clock className="w-2.5 h-2.5" />
          {relativeTime(audit.decisionTime)}
        </span>
      </div>

      {/* Second row: metrics */}
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        <Metric label="Conf" value={`${Math.round(audit.confidence)}%`} valueClass={confidenceColor(audit.confidence)} />
        <Metric label="Quality" value={String(Math.round(audit.qualityScore))} valueClass={qualityColor(audit.qualityScore)} />
        <Metric
          label="PnL"
          value={audit.outcomeTracked ? signedPnl(audit.outcomePnl) : "—"}
          valueClass={audit.outcomeTracked ? pnlColor(audit.outcomePnl) : "text-slate-600"}
        />
        <Metric
          label="Δ Conf"
          valueNode={confidenceChangeRender(audit.confidenceChange)}
        />
        <Metric
          label="Latency"
          value={latencyFormat(audit.processingLatency)}
          valueClass={latencyColor(audit.processingLatency)}
        />
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
          <FileSearch className="w-2.5 h-2.5" />
          Review
        </span>
      </div>
    </button>
  );
}

function Metric({
  label,
  value,
  valueNode,
  valueClass,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      {valueNode ?? (
        <span className={`tt-mono text-[11px] font-semibold ${valueClass ?? "text-slate-300"}`}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterKey }) {
  const msg =
    filter === "unresolved"
      ? "No unresolved decisions."
      : filter === "wins"
      ? "No winning decisions yet."
      : filter === "losses"
      ? "No losing decisions yet."
      : "No decisions audited yet.";
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
        <History className="w-4 h-4 text-slate-500" />
      </div>
      <p className="text-xs text-slate-400">{msg}</p>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 bg-white/5" />
        ))}
      </div>
      <Skeleton className="h-5 w-2/3 bg-white/5" />
      <Skeleton className="h-5 w-3/4 bg-white/5" />
      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function PanelError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-3 p-4">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4 text-red-400" />
      </div>
      <p className="text-xs text-slate-300">{error}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="h-7 text-xs">
        Retry
      </Button>
    </div>
  );
}

export default AuditPanel;
