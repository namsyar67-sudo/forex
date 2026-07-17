"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  GitBranch,
  Layers,
  Boxes,
  Zap,
  Target,
  AlertCircle,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
  Gauge,
  Sigma,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";
import { formatPrice, formatTime, relativeTime } from "@/lib/format";
import type {
  SmartMoneyAnalysis,
  StructureBreak,
  OrderBlock,
  FairValueGap,
  MarketPhase,
} from "@/lib/smart-money/engine";

interface SmartMoneyPanelProps {
  symbol: string;
}

interface ApiResponse {
  analysis: SmartMoneyAnalysis;
  time: number;
}

// ----- Color helpers ---------------------------------------------------------
function biasBadgeClass(bias: string): string {
  if (bias === "bullish")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (bias === "bearish")
    return "bg-red-500/15 text-red-300 border-red-500/40";
  return "bg-slate-500/15 text-slate-300 border-slate-500/40";
}

function structureBadgeClass(type: StructureBreak["type"]): string {
  switch (type) {
    case "BOS":
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/40";
    case "CHOCH":
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "EXTERNAL_BOS":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "INTERNAL_BOS":
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/40";
  }
}

function phaseColor(phase: MarketPhase["phase"]): string {
  switch (phase) {
    case "accumulation":
    case "reaccumulation":
      return "text-sky-300";
    case "markup":
      return "text-emerald-300";
    case "distribution":
    case "redistribution":
      return "text-amber-300";
    case "markdown":
      return "text-red-300";
    case "manipulation":
      return "text-fuchsia-300";
    case "expansion":
      return "text-orange-300";
    default:
      return "text-slate-300";
  }
}

function digitsFor(symbol: string): number {
  return INSTRUMENT_MAP[symbol]?.digits ?? 2;
}

// ----- Component -------------------------------------------------------------
export function SmartMoneyPanel({ symbol }: SmartMoneyPanelProps) {
  const [analysis, setAnalysis] = useState<SmartMoneyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const upperSymbol = symbol.toUpperCase();
  const digits = digitsFor(upperSymbol);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/smart-money/${encodeURIComponent(upperSymbol)}?tf=h1`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as ApiResponse;
      setAnalysis(json.analysis);
    } catch {
      setError(true);
      toast.error(`Failed to load smart-money analysis for ${upperSymbol}`);
    } finally {
      setLoading(false);
    }
  }, [upperSymbol]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Derived views -------------------------------------------------------------
  const summary = analysis?.summary;
  const pd = analysis?.premiumDiscount;
  const breaks = analysis?.breaks ?? [];
  const orderBlocks = analysis?.orderBlocks ?? [];
  const fvgs = analysis?.fairValueGaps ?? [];

  const recentBreaks = useMemo(
    () => [...breaks].slice(-5).reverse(),
    [breaks]
  );
  const activeObs = useMemo(
    () => orderBlocks.filter((o) => !o.mitigated).slice(-5).reverse(),
    [orderBlocks]
  );
  const activeFvgs = useMemo(
    () => fvgs.filter((f) => !f.filled).slice(-5).reverse(),
    [fvgs]
  );
  const currentPhase = useMemo(() => {
    const phases = analysis?.phases ?? [];
    return phases.length > 0 ? phases[phases.length - 1] : null;
  }, [analysis]);

  // Premium/Discount zone label ----------------------------------------------
  const zoneLabel = useMemo(() => {
    if (!pd) return "—";
    if (pd.position > 0.75) return "Premium";
    if (pd.position < 0.25) return "Discount";
    return "Equilibrium";
  }, [pd]);

  const biasPct = summary
    ? Math.round(Math.max(0, Math.min(1, summary.biasStrength)) * 100)
    : 0;

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch className="w-4 h-4 text-fuchsia-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2">
              <span>Smart Money Concepts</span>
              <span className="tt-mono text-[11px] text-slate-400">{upperSymbol}</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              ICT structure · H1
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {summary && (
            <>
              <Badge
                variant="outline"
                className={`h-6 ${biasBadgeClass(summary.bias)} tt-mono uppercase text-[10px]`}
              >
                {summary.bias}
              </Badge>
              <div className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-slate-500" />
                <span className="tt-mono text-xs text-slate-200">{biasPct}%</span>
              </div>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchData}
            disabled={loading}
            className="h-7 w-7 p-0"
            title="Refresh"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll p-3 space-y-3">
        {loading && !analysis ? (
          <SmartMoneySkeleton />
        ) : error && !analysis ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center gap-2 text-slate-500">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div className="text-xs">Failed to load smart-money analysis.</div>
            <Button size="sm" variant="outline" onClick={fetchData} className="h-7 text-[11px]">
              Retry
            </Button>
          </div>
        ) : !analysis ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-xs text-slate-500">
            No analysis available.
          </div>
        ) : (
          <>
            {/* Market structure card */}
            <Card>
              <CardHeader icon={<Activity className="w-3.5 h-3.5 text-fuchsia-400" />} title="Market Structure" />
              <div className="grid grid-cols-3 gap-2">
                <MiniCell
                  label="Structure"
                  value={
                    <span
                      className={
                        summary?.marketStructure === "bullish"
                          ? "text-emerald-300"
                          : summary?.marketStructure === "bearish"
                          ? "text-red-300"
                          : "text-slate-300"
                      }
                    >
                      {summary?.marketStructure ?? "—"}
                    </span>
                  }
                />
                <MiniCell
                  label="Last BOS"
                  value={
                    summary?.lastBOS ? (
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`tt-mono text-[10px] ${
                            summary.lastBOS.direction === "bullish"
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          {summary.lastBOS.direction}
                        </span>
                        <span className="tt-mono text-[10px] text-slate-500">
                          {relativeTime(new Date(summary.lastBOS.breakTime).toISOString())}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )
                  }
                />
                <MiniCell
                  label="Last CHOCH"
                  value={
                    summary?.lastCHOCH ? (
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`tt-mono text-[10px] ${
                            summary.lastCHOCH.direction === "bullish"
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          {summary.lastCHOCH.direction}
                        </span>
                        <span className="tt-mono text-[10px] text-slate-500">
                          {relativeTime(new Date(summary.lastCHOCH.breakTime).toISOString())}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )
                  }
                />
              </div>
            </Card>

            {/* Premium / Discount card */}
            <Card>
              <CardHeader
                icon={<Target className="w-3.5 h-3.5 text-sky-400" />}
                title="Premium / Discount"
                right={
                  pd && (
                    <Badge
                      variant="outline"
                      className={`h-5 text-[10px] tt-mono ${
                        zoneLabel === "Premium"
                          ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                          : zoneLabel === "Discount"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-500/10 text-slate-300 border-slate-500/30"
                      }`}
                    >
                      {zoneLabel}
                    </Badge>
                  )
                }
              />
              {pd && (
                <div className="flex gap-3">
                  {/* Vertical bar */}
                  <div className="relative w-7 shrink-0">
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-2.5 rounded-full bg-gradient-to-t from-emerald-500/30 via-slate-600/30 to-rose-500/30" />
                    {/* Premium zone shading (top 25%) */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-2.5 rounded-t-full bg-rose-500/20"
                      style={{ top: 0, height: "25%" }}
                    />
                    {/* Discount zone shading (bottom 25%) */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-2.5 rounded-b-full bg-emerald-500/20"
                      style={{ bottom: 0, height: "25%" }}
                    />
                    {/* Equilibrium line */}
                    <div
                      className="absolute left-0 right-0 h-px bg-white/30"
                      style={{ top: "50%" }}
                    />
                    {/* Position marker */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white bg-slate-900 shadow"
                      style={{
                        bottom: `calc(${(pd.position * 100).toFixed(2)}% - 8px)`,
                      }}
                      title={`Position ${(pd.position * 100).toFixed(1)}%`}
                    />
                  </div>
                  {/* Numeric details */}
                  <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <DetailRow
                      label="High"
                      value={formatPrice(pd.high, digits)}
                      tone="up"
                    />
                    <DetailRow
                      label="Low"
                      value={formatPrice(pd.low, digits)}
                      tone="down"
                    />
                    <DetailRow
                      label="Equilibrium"
                      value={formatPrice(pd.equilibrium, digits)}
                    />
                    <DetailRow
                      label="Position"
                      value={`${(pd.position * 100).toFixed(1)}%`}
                    />
                    <DetailRow
                      label="Premium Zone"
                      value={`${formatPrice(pd.premiumZone.bottom, digits)} – ${formatPrice(pd.premiumZone.top, digits)}`}
                      tone="down"
                    />
                    <DetailRow
                      label="Discount Zone"
                      value={`${formatPrice(pd.discountZone.bottom, digits)} – ${formatPrice(pd.discountZone.top, digits)}`}
                      tone="up"
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Counts grid */}
            <Card>
              <CardHeader icon={<Boxes className="w-3.5 h-3.5 text-violet-400" />} title="Active Confluences" />
              <div className="grid grid-cols-4 gap-1.5">
                <CountCell
                  label="OBs"
                  value={summary?.activeOrderBlocks ?? 0}
                  icon={<Layers className="w-3 h-3" />}
                  tone="emerald"
                />
                <CountCell
                  label="FVGs"
                  value={summary?.activeFVGs ?? 0}
                  icon={<Zap className="w-3 h-3" />}
                  tone="amber"
                />
                <CountCell
                  label="Liq Swept"
                  value={summary?.liquiditySwept ?? 0}
                  icon={<Waves className="w-3 h-3" />}
                  tone="sky"
                />
                <CountCell
                  label="Breakers"
                  value={analysis?.breakerBlocks?.length ?? 0}
                  icon={<AlertCircle className="w-3 h-3" />}
                  tone="rose"
                />
                <CountCell
                  label="Mitigation"
                  value={analysis?.mitigationBlocks?.length ?? 0}
                  icon={<Target className="w-3 h-3" />}
                  tone="slate"
                />
                <CountCell
                  label="Equal Lvl"
                  value={analysis?.equalLevels?.length ?? 0}
                  icon={<Sigma className="w-3 h-3" />}
                  tone="violet"
                />
                <CountCell
                  label="Inducement"
                  value={analysis?.inducements?.length ?? 0}
                  icon={<GitBranch className="w-3 h-3" />}
                  tone="fuchsia"
                />
                <CountCell
                  label="Phases"
                  value={analysis?.phases?.length ?? 0}
                  icon={<Activity className="w-3 h-3" />}
                  tone="cyan"
                />
              </div>
            </Card>

            {/* Current phase */}
            {currentPhase && (
              <Card>
                <CardHeader
                  icon={<Activity className="w-3.5 h-3.5 text-cyan-400" />}
                  title="Current Market Phase"
                />
                <div className="flex items-center justify-between">
                  <div className={`text-sm font-semibold capitalize ${phaseColor(currentPhase.phase)}`}>
                    {currentPhase.phase}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Confidence</span>
                    <span className="tt-mono text-xs text-slate-200">
                      {(currentPhase.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400/60"
                    style={{ width: `${Math.round(currentPhase.confidence * 100)}%` }}
                  />
                </div>
              </Card>
            )}

            {/* Recent structure breaks */}
            <Card>
              <CardHeader icon={<GitBranch className="w-3.5 h-3.5 text-amber-400" />} title="Recent Structure Breaks" />
              {recentBreaks.length === 0 ? (
                <EmptyLine label="No structure breaks detected" />
              ) : (
                <ul className="space-y-1">
                  {recentBreaks.map((b, i) => (
                    <li
                      key={`${b.breakIndex}-${i}`}
                      className="flex items-center justify-between gap-2 py-1 border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge
                          variant="outline"
                          className={`h-5 text-[9px] tt-mono ${structureBadgeClass(b.type)}`}
                        >
                          {b.type}
                        </Badge>
                        {b.direction === "bullish" ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span className="tt-mono text-[10px] text-slate-300">
                          {formatPrice(b.brokenLevel, digits)}
                        </span>
                      </div>
                      <span className="tt-mono text-[10px] text-slate-500 shrink-0">
                        {formatTime(new Date(b.breakTime).toISOString())}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Active Order Blocks */}
            <Card>
              <CardHeader icon={<Layers className="w-3.5 h-3.5 text-emerald-400" />} title="Active Order Blocks" />
              {activeObs.length === 0 ? (
                <EmptyLine label="No active order blocks" />
              ) : (
                <ul className="space-y-1.5">
                  {activeObs.map((ob, i) => (
                    <OrderBlockRow key={`ob-${i}`} ob={ob} digits={digits} />
                  ))}
                </ul>
              )}
            </Card>

            {/* Active FVGs */}
            <Card>
              <CardHeader icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} title="Active Fair Value Gaps" />
              {activeFvgs.length === 0 ? (
                <EmptyLine label="No active fair value gaps" />
              ) : (
                <ul className="space-y-1.5">
                  {activeFvgs.map((f, i) => (
                    <FvgRow key={`fvg-${i}`} fvg={f} digits={digits} />
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ----- Sub-components --------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.015] p-2.5">
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-slate-400">{title}</span>
      </div>
      {right}
    </div>
  );
}

function MiniCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-white/[0.02] border border-white/5 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xs mt-0.5">{value}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  const toneClass =
    tone === "up"
      ? "tt-text-up"
      : tone === "down"
      ? "tt-text-down"
      : "text-slate-200";
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="uppercase tracking-wider text-slate-500 shrink-0">{label}</span>
      <span className={`tt-mono truncate ${toneClass}`} title={value}>
        {value}
      </span>
    </div>
  );
}

const COUNT_TONES: Record<string, string> = {
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  sky: "text-sky-300",
  rose: "text-rose-300",
  slate: "text-slate-300",
  violet: "text-violet-300",
  fuchsia: "text-fuchsia-300",
  cyan: "text-cyan-300",
};

function CountCell({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: keyof typeof COUNT_TONES | string;
}) {
  const toneClass = COUNT_TONES[tone] ?? "text-slate-300";
  return (
    <div className="rounded-md bg-white/[0.02] border border-white/5 px-1.5 py-1.5 text-center">
      <div className={`flex items-center justify-center mb-0.5 ${toneClass}`}>
        {icon}
      </div>
      <div className={`tt-mono text-sm font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function OrderBlockRow({ ob, digits }: { ob: OrderBlock; digits: number }) {
  const isBull = ob.type === "bullish";
  const pct = Math.round(Math.max(0, Math.min(1, ob.strength)) * 100);
  return (
    <li className="flex flex-col gap-1 py-1 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isBull ? (
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400" />
          )}
          <span
            className={`text-[10px] uppercase font-medium ${
              isBull ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {ob.type}
          </span>
          <span className="tt-mono text-[10px] text-slate-300">
            {formatPrice(ob.bottom, digits)} – {formatPrice(ob.top, digits)}
          </span>
        </div>
        {ob.mitigated && (
          <Badge
            variant="outline"
            className="h-4 text-[9px] bg-slate-500/10 text-slate-400 border-slate-500/30"
          >
            mitigated
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className={isBull ? "h-full bg-emerald-400/60" : "h-full bg-red-400/60"}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="tt-mono text-[9px] text-slate-500 w-8 text-right">{pct}%</span>
      </div>
    </li>
  );
}

function FvgRow({ fvg, digits }: { fvg: FairValueGap; digits: number }) {
  const isBull = fvg.type === "bullish";
  return (
    <li className="flex items-center justify-between gap-2 py-1 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        {isBull ? (
          <TrendingUp className="w-3 h-3 text-emerald-400" />
        ) : (
          <TrendingDown className="w-3 h-3 text-red-400" />
        )}
        <span
          className={`text-[10px] uppercase font-medium ${
            isBull ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {fvg.type}
        </span>
        <span className="tt-mono text-[10px] text-slate-300">
          {formatPrice(fvg.bottom, digits)} – {formatPrice(fvg.top, digits)}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="tt-mono text-[9px] text-slate-500">{fvg.age}b</span>
        {fvg.filled && (
          <Badge
            variant="outline"
            className="h-4 text-[9px] bg-slate-500/10 text-slate-400 border-slate-500/30"
          >
            filled
          </Badge>
        )}
      </div>
    </li>
  );
}

function EmptyLine({ label }: { label: string }) {
  return <div className="text-[10px] text-slate-600 italic py-1">{label}</div>;
}

function SmartMoneySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export default SmartMoneyPanel;
