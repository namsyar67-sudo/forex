"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Gauge,
  Loader2,
  Radio,
  Timer,
  TrendingDown,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// ---------- Types ----------

interface MetricStats {
  avg: number;
  min: number;
  max: number;
  p95: number;
  count: number;
}

interface LatencyStats {
  newsArrival: MetricStats;
  processing: MetricStats;
  reanalysis: MetricStats;
  notification: MetricStats;
  total: MetricStats;
}

interface LatencyResponse {
  stats: LatencyStats;
  source: string;
  time: number;
}

const REFRESH_MS = 15_000;

// ---------- Helpers ----------

function latencyColor(ms: number): string {
  if (ms < 1000) return "tt-text-up";
  if (ms < 5000) return "tt-text-accent";
  return "tt-text-down";
}

function latencyBg(ms: number): string {
  if (ms < 1000) return "border-emerald-500/30 bg-emerald-500/5";
  if (ms < 5000) return "border-amber-500/30 bg-amber-500/5";
  return "border-red-500/30 bg-red-500/5";
}

function latencyDot(ms: number): string {
  if (ms < 1000) return "bg-emerald-500";
  if (ms < 5000) return "bg-amber-500";
  return "bg-red-500";
}

function latencyIcon(ms: number): React.ReactNode {
  if (ms < 1000) return <CheckCircle className="w-3 h-3 tt-text-up" />;
  if (ms < 5000) return <AlertTriangle className="w-3 h-3 tt-text-accent" />;
  return <AlertTriangle className="w-3 h-3 tt-text-down" />;
}

function formatMs(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ---------- Verdict logic ----------

type Verdict = "excellent" | "good" | "needs_improvement" | "critical" | "no_data";

function verdictFromTotal(total: MetricStats): Verdict {
  if (!total || !total.count) return "no_data";
  const avg = total.avg;
  if (avg < 1000) return "excellent";
  if (avg < 3000) return "good";
  if (avg < 6000) return "needs_improvement";
  return "critical";
}

const VERDICT_META: Record<
  Verdict,
  { label: string; class: string; icon: React.ReactNode; desc: string }
> = {
  excellent: {
    label: "Excellent",
    class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    icon: <CheckCircle className="w-3 h-3" />,
    desc: "End-to-end latency is well within target. News is processed fast enough to capture most opportunities.",
  },
  good: {
    label: "Good",
    class: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    icon: <Activity className="w-3 h-3" />,
    desc: "Latency is acceptable. Minor optimizations could improve reaction time to fast-moving news.",
  },
  needs_improvement: {
    label: "Needs Improvement",
    class: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    icon: <AlertTriangle className="w-3 h-3" />,
    desc: "Latency is high enough that some opportunities may be missed. Consider optimizing processing pipelines.",
  },
  critical: {
    label: "Critical",
    class: "bg-red-500/10 text-red-400 border-red-500/30",
    icon: <AlertTriangle className="w-3 h-3" />,
    desc: "Latency is too high. Fast-breaking news will likely be acted on too late. Immediate optimization needed.",
  },
  no_data: {
    label: "No Data",
    class: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    icon: <Clock className="w-3 h-3" />,
    desc: "No latency metrics collected yet. Metrics populate as decisions are made and audited.",
  },
};

// ---------- Recommendations ----------

function buildRecommendations(stats: LatencyStats): string[] {
  const recs: string[] = [];
  if (stats.newsArrival?.avg >= 5000) {
    recs.push(
      `News arrival averaging ${formatMs(stats.newsArrival.avg)} — check news source polling interval and provider latency.`
    );
  }
  if (stats.processing?.avg >= 3000) {
    recs.push(
      `Processing averaging ${formatMs(stats.processing.avg)} — consider caching AI responses or reducing agent scope.`
    );
  }
  if (stats.reanalysis?.avg >= 3000) {
    recs.push(
      `Reanalysis averaging ${formatMs(stats.reanalysis.avg)} — review trigger conditions to avoid redundant re-runs.`
    );
  }
  if (stats.notification?.avg >= 2000) {
    recs.push(
      `Notification averaging ${formatMs(stats.notification.avg)} — check WebSocket fan-out and client subscription overhead.`
    );
  }
  if (stats.total?.avg >= 5000) {
    recs.push(
      "Total latency exceeds 5s — prioritize the slowest stage above first."
    );
  }
  return recs;
}

// ---------- Component ----------

export function LatencyPanel() {
  const [data, setData] = useState<LatencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/audit/latency", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as LatencyResponse;
      setData(json);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load latency stats";
      if (!silent) setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Timer className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-semibold text-slate-100 truncate">
              Latency Monitor
            </h2>
            <span className="text-[10px] text-slate-500 truncate">
              Real-time performance tracking
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/5 capitalize">
              <Radio className="w-2.5 h-2.5" />
              {data.source}
            </span>
          )}
          {refreshing ? (
            <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => fetchData()}
              title="Refresh"
            >
              <Activity className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <PanelSkeleton />
        ) : error ? (
          <PanelError error={error} onRetry={() => fetchData()} />
        ) : !data ? (
          <PanelSkeleton />
        ) : (
          <div className="p-3 space-y-3">
            {/* Latency cards */}
            <div className="space-y-2">
              <LatencyCard
                name="News Arrival"
                description="Time from news publication to ingestion"
                icon={<Radio className="w-3 h-3" />}
                stats={data.stats.newsArrival}
              />
              <LatencyCard
                name="Processing"
                description="Multi-agent analysis + decision"
                icon={<Cpu className="w-3 h-3" />}
                stats={data.stats.processing}
              />
              <LatencyCard
                name="Reanalysis"
                description="Post-news re-evaluation trigger"
                icon={<Activity className="w-3 h-3" />}
                stats={data.stats.reanalysis}
              />
              <LatencyCard
                name="Notification"
                description="Decision dispatch to clients"
                icon={<Zap className="w-3 h-3" />}
                stats={data.stats.notification}
              />
              <LatencyCard
                name="Total"
                description="End-to-end: news arrival → notification"
                icon={<Timer className="w-3 h-3" />}
                stats={data.stats.total}
                highlight
              />
            </div>

            {/* Performance assessment */}
            <PerformanceAssessment stats={data.stats} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Latency Card ----------

function LatencyCard({
  name,
  description,
  icon,
  stats,
  highlight,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  stats: MetricStats;
  highlight?: boolean;
}) {
  const { avg, min, max, p95, count } = stats;
  const hasData = count > 0;
  const avgColor = hasData ? latencyColor(avg) : "text-slate-500";
  const cardBg = hasData ? latencyBg(avg) : "border-white/5 bg-black/20";

  // Mini bar: avg vs p95 (relative to max)
  const safeMax = Math.max(max, p95, avg, 1);
  const avgPct = hasData ? Math.min(100, (avg / safeMax) * 100) : 0;
  const p95Pct = hasData ? Math.min(100, (p95 / safeMax) * 100) : 0;

  return (
    <div
      className={`rounded-md border ${cardBg} ${
        highlight ? "p-2.5" : "p-2"
      } transition-colors`}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-slate-400">{icon}</span>
        <span className="text-xs font-semibold text-slate-100">{name}</span>
        {highlight && (
          <span className="text-[9px] uppercase tracking-wider text-slate-500 px-1 py-0.5 rounded bg-white/5">
            end-to-end
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          {hasData ? latencyIcon(avg) : <Clock className="w-3 h-3 text-slate-500" />}
        </span>
      </div>

      {/* Big average */}
      <div className="flex items-end gap-2 mb-1.5">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            Average
          </div>
          <div className={`tt-mono ${highlight ? "text-2xl" : "text-xl"} font-bold ${avgColor}`}>
            {hasData ? formatMs(avg) : "—"}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            P95
          </div>
          <div className={`tt-mono text-sm font-semibold ${
            hasData ? latencyColor(p95) : "text-slate-500"
          }`}>
            {hasData ? formatMs(p95) : "—"}
          </div>
        </div>
      </div>

      {/* Mini bar */}
      {hasData && (
        <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden mb-1.5">
          {/* P95 bar (background) */}
          <div
            className="absolute inset-y-0 left-0 bg-white/10"
            style={{ width: `${p95Pct}%` }}
          />
          {/* Avg bar (foreground) */}
          <div
            className={`absolute inset-y-0 left-0 ${latencyDot(avg)}`}
            style={{ width: `${avgPct}%` }}
          />
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-3 text-[9px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="uppercase tracking-wider">Min</span>
          <span className="tt-mono text-slate-300">
            {hasData ? formatMs(min) : "—"}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <span className="uppercase tracking-wider">Max</span>
          <span className="tt-mono text-slate-300">
            {hasData ? formatMs(max) : "—"}
          </span>
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <span className="uppercase tracking-wider">Count</span>
          <span className="tt-mono text-slate-300">{count}</span>
        </span>
      </div>

      {/* Description */}
      <p className="text-[9px] text-slate-500 mt-1 italic">{description}</p>
    </div>
  );
}

// ---------- Performance Assessment ----------

function PerformanceAssessment({ stats }: { stats: LatencyStats }) {
  const verdict = verdictFromTotal(stats.total);
  const meta = VERDICT_META[verdict];
  const total = stats.total;
  const recommendations = buildRecommendations(stats);

  return (
    <div className="rounded-md border border-white/5 bg-black/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Gauge className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Performance Assessment
        </span>
      </div>

      {/* Verdict badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold uppercase border ${meta.class}`}
        >
          {meta.icon}
          {meta.label}
        </span>
        {total.count > 0 && (
          <span className="text-[10px] text-slate-500">
            over <span className="tt-mono text-slate-300">{total.count}</span> measurements
          </span>
        )}
      </div>

      {/* Explanation */}
      <p className="text-[11px] text-slate-300 leading-relaxed">
        {meta.desc}
      </p>

      {/* Concrete impact */}
      {verdict !== "no_data" && total.avg > 0 && (
        <p className="text-[10px] text-slate-500 leading-relaxed italic">
          If news arrives{" "}
          <span className={`tt-mono font-semibold ${latencyColor(total.avg)}`}>
            {formatMs(total.avg)}
          </span>{" "}
          late, opportunities may be missed or executed at stale prices.
        </p>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-1 mt-1">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
            <TrendingDown className="w-3 h-3" />
            Recommendations
          </div>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[10px] text-slate-300 leading-relaxed"
              >
                <span className="tt-text-accent mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stage breakdown (where is the time going) */}
      {verdict !== "no_data" && (
        <StageBreakdown stats={stats} />
      )}
    </div>
  );
}

function StageBreakdown({ stats }: { stats: LatencyStats }) {
  const stages = [
    { name: "News Arrival", value: stats.newsArrival.avg, color: "bg-sky-500" },
    { name: "Processing", value: stats.processing.avg, color: "bg-violet-500" },
    { name: "Reanalysis", value: stats.reanalysis.avg, color: "bg-amber-500" },
    { name: "Notification", value: stats.notification.avg, color: "bg-emerald-500" },
  ];
  const total = stats.total.avg || stages.reduce((s, x) => s + (x.value || 0), 0) || 1;

  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
        Where the time goes
      </div>
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-white/5 mb-2">
        {stages.map((s) => {
          const pct = Math.max(0, Math.min(100, ((s.value || 0) / total) * 100));
          if (pct === 0) return null;
          return (
            <div
              key={s.name}
              className={s.color}
              style={{ width: `${pct}%` }}
              title={`${s.name}: ${formatMs(s.value || 0)} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-1">
        {stages.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-[9px] text-slate-500">
            <span className={`w-2 h-2 rounded-sm ${s.color}`} />
            <span className="truncate">{s.name}</span>
            <span className="ml-auto tt-mono text-slate-300">
              {formatMs(s.value || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Skeleton / Error ----------

function PanelSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full bg-white/5" />
      ))}
      <Skeleton className="h-40 w-full bg-white/5" />
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

export default LatencyPanel;
