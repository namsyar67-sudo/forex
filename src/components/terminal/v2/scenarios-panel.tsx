"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Crosshair,
  Layers,
  Loader2,
  Minus,
  RefreshCw,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Direction = "bullish" | "bearish" | "neutral";

interface Scenario {
  name: string;
  probability: number; // 0..100
  direction: Direction;
  trigger: string;
  target: string;
  invalidation: string;
  description: string;
}

interface ScenarioResult {
  symbol: string;
  scenarios: Scenario[];
  primaryScenario: Scenario;
}

interface ScenariosPanelProps {
  symbol: string;
}

const DIRECTION_STYLES: Record<
  Direction,
  { border: string; label: string; color: string; badge: string; bar: string }
> = {
  bullish: {
    border: "border-l-emerald-500",
    label: "BULLISH",
    color: "tt-text-up",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    bar: "bg-emerald-500",
  },
  bearish: {
    border: "border-l-red-500",
    label: "BEARISH",
    color: "tt-text-down",
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    bar: "bg-red-500",
  },
  neutral: {
    border: "border-l-slate-500",
    label: "NEUTRAL",
    color: "tt-text-dim",
    badge: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    bar: "bg-slate-500",
  },
};

function DirectionIcon({ direction }: { direction: Direction }) {
  if (direction === "bullish") return <TrendingUp className="w-3 h-3" />;
  if (direction === "bearish") return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

export function ScenariosPanel({ symbol }: ScenariosPanelProps) {
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await fetch(`/api/scenarios/${symbol}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setResult((data.scenarios ?? null) as ScenarioResult | null);
        setError(false);
      } catch {
        if (!silent) {
          setError(true);
          toast.error("Failed to load scenarios");
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
    setResult(null);
    fetchData(false);
    const id = setInterval(() => fetchData(true), 45000);
    return () => clearInterval(id);
  }, [fetchData, symbol]);

  const primary = result?.primaryScenario ?? null;
  const primaryName = primary?.name;
  const others = (result?.scenarios ?? []).filter((s) => s.name !== primaryName);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">Scenario Engine</span>
          <span className="text-xs text-slate-500 truncate">· {symbol}</span>
        </div>
        <button
          onClick={() => fetchData(false)}
          disabled={refreshing}
          className="text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors shrink-0"
          title="Refresh"
          aria-label="Refresh scenarios"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <ScenariosSkeleton />
        ) : error || !result || !primary ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed mb-3">
              Failed to load scenarios for {symbol}.
            </p>
            <button
              onClick={() => fetchData(false)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-2.5">
            {/* Primary scenario */}
            <PrimaryCard scenario={primary} />

            {/* Alternative scenarios */}
            {others.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1">
                  Alternative Scenarios
                </div>
                {others.map((s, i) => (
                  <ScenarioCard key={`${s.name}-${i}`} scenario={s} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PrimaryCard({ scenario }: { scenario: Scenario }) {
  const style = DIRECTION_STYLES[scenario.direction];
  return (
    <div
      className={`rounded-lg border border-white/5 border-l-2 ${style.border} bg-black/30 p-3`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            Primary Scenario
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-100">{scenario.name}</span>
            <span
              className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border font-semibold ${style.badge}`}
            >
              <DirectionIcon direction={scenario.direction} />
              {style.label}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Probability</div>
          <div className={`text-lg font-bold tt-mono leading-none ${style.color}`}>
            {scenario.probability}%
          </div>
        </div>
      </div>

      {/* Probability bar */}
      <div className="h-1.5 rounded-full bg-black/40 overflow-hidden mb-2.5">
        <div
          className={`h-full ${style.bar}`}
          style={{ width: `${Math.min(100, Math.max(0, scenario.probability))}%` }}
        />
      </div>

      {/* Description */}
      <p className="text-[11px] text-slate-300 leading-relaxed mb-2.5">
        {scenario.description}
      </p>

      {/* Mini rows: Trigger, Target, Invalidation */}
      <div className="space-y-1.5">
        <MiniRow
          icon={<Crosshair className="w-3 h-3" />}
          label="Trigger"
          value={scenario.trigger}
        />
        <MiniRow
          icon={<Target className="w-3 h-3" />}
          label="Target"
          value={scenario.target}
          valueClass="tt-text-up"
        />
        <MiniRow
          icon={<Shield className="w-3 h-3" />}
          label="Invalidation"
          value={scenario.invalidation}
          valueClass="tt-text-down"
        />
      </div>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const style = DIRECTION_STYLES[scenario.direction];
  return (
    <div
      className={`rounded-md border border-white/5 border-l-2 ${style.border} bg-black/20 px-2.5 py-2 hover:bg-black/30 transition-colors`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`shrink-0 ${style.color}`}>
            <DirectionIcon direction={scenario.direction} />
          </span>
          <span className="text-xs font-medium text-slate-200 truncate">
            {scenario.name}
          </span>
        </div>
        <span className={`text-[10px] tt-mono ${style.color} shrink-0`}>
          {scenario.probability}%
        </span>
      </div>
      {/* Probability bar */}
      <div className="h-1 rounded-full bg-black/40 overflow-hidden">
        <div
          className={`h-full ${style.bar}`}
          style={{ width: `${Math.min(100, Math.max(0, scenario.probability))}%` }}
        />
      </div>
    </div>
  );
}

function MiniRow({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-black/30 border border-white/5 px-2 py-1.5">
      <span className="text-slate-500 shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`text-[11px] tt-mono ${valueClass ?? "text-slate-200"} break-words`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function ScenariosSkeleton() {
  return (
    <div className="p-3 space-y-2.5">
      <Skeleton className="h-52 w-full bg-white/5" />
      <Skeleton className="h-3 w-36 bg-white/5" />
      <Skeleton className="h-12 w-full bg-white/5" />
      <Skeleton className="h-12 w-full bg-white/5" />
    </div>
  );
}

export default ScenariosPanel;
