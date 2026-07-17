"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  Check,
  Clock,
  Droplets,
  Gauge,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatTime, relativeTime } from "@/lib/format";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";

type Direction = "long" | "short";
type SignalType = "STRONG_BUY" | "BUY" | "WAIT" | "SELL" | "STRONG_SELL";
type RiskLevel = "low" | "medium" | "high" | "extreme";
type EventPriority = "low" | "medium" | "high" | "critical";

interface ActiveSignal {
  id: string;
  symbol: string;
  direction: Direction;
  signalType: SignalType;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  confidence: number;
  qualityScore: number;
  expectedDuration: string;
  expectedProbability: number;
  riskLevel: RiskLevel;
  marketSession: string;
  reasons: string[];
  summary: string;
  livePnl?: number;
  distToTP1?: number;
  distToSL?: number;
  indicators: Record<string, unknown>;
  status: string;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  createdAt: string;
  closedAt?: string | null;
  closeReason?: string | null;
  closePnl?: number | null;
}

interface TradeEvent {
  id: string;
  signalId: string | null;
  symbol: string;
  type: string;
  title: string;
  message: string;
  reason: string;
  confidence: number | null;
  priority: EventPriority;
  read: boolean;
  createdAt: string;
}

interface SignalDetailResponse {
  signal: ActiveSignal;
  events: TradeEvent[];
  time: number;
}

interface SignalDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signalId: string | null;
}

const DIRECTION_BADGE: Record<Direction, string> = {
  long: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  short: "bg-red-500/15 text-red-400 border-red-500/30",
};

const SIGNAL_TYPE_BADGE: Record<SignalType, string> = {
  STRONG_BUY: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40",
  BUY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  WAIT: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  SELL: "bg-red-500/15 text-red-400 border-red-500/30",
  STRONG_SELL: "bg-red-400/20 text-red-300 border-red-400/40",
};

const RISK_BADGE: Record<RiskLevel, string> = {
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  extreme: "bg-red-500/15 text-red-400 border-red-500/30",
};

function digitsFor(symbol: string): number {
  return INSTRUMENT_MAP[symbol]?.digits ?? 5;
}

function qualityColor(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function qualityStroke(score: number): string {
  if (score >= 85) return "#6ee7b7";
  if (score >= 70) return "#34d399";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function pnlColor(v: number): string {
  if (v > 0) return "tt-text-up";
  if (v < 0) return "tt-text-down";
  return "tt-text-dim";
}

function signedPct(v: number): string {
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

function priorityColor(p: EventPriority): string {
  switch (p) {
    case "critical": return "bg-red-500";
    case "high": return "bg-orange-500";
    case "medium": return "bg-sky-500";
    case "low":
    default: return "bg-slate-500";
  }
}

function priorityRing(p: EventPriority): string {
  switch (p) {
    case "critical": return "ring-red-500/40";
    case "high": return "ring-orange-500/40";
    case "medium": return "ring-sky-500/40";
    case "low":
    default: return "ring-slate-500/40";
  }
}

function priorityLabel(p: EventPriority): string {
  return p.toUpperCase();
}

function eventIcon(type: string) {
  switch (type) {
    case "NEW_SIGNAL": return <Zap className="w-3.5 h-3.5" />;
    case "HIGH_IMPACT_NEWS":
    case "NEWS_CHANGED": return <Newspaper className="w-3.5 h-3.5" />;
    case "CLOSE_POSITION": return <X className="w-3.5 h-3.5" />;
    case "MOVE_STOP_LOSS": return <ArrowRightLeft className="w-3.5 h-3.5" />;
    case "TAKE_PROFIT_HIT": return <Target className="w-3.5 h-3.5" />;
    case "MARKET_STRUCTURE_CHANGED":
    case "TREND_CHANGE":
    case "CONFIDENCE_CHANGED": return <Activity className="w-3.5 h-3.5" />;
    case "VOLATILITY_ALERT": return <Gauge className="w-3.5 h-3.5" />;
    case "LIQUIDITY_ALERT": return <Droplets className="w-3.5 h-3.5" />;
    case "BOS_DETECTED": return <TrendingUp className="w-3.5 h-3.5" />;
    case "CHOCH_DETECTED": return <RefreshCw className="w-3.5 h-3.5" />;
    case "OB_BROKEN":
    case "RISK_ELEVATED": return <ShieldAlert className="w-3.5 h-3.5" />;
    default: return <Activity className="w-3.5 h-3.5" />;
  }
}

export function SignalDetailDialog({
  open,
  onOpenChange,
  signalId,
}: SignalDetailDialogProps) {
  const [data, setData] = useState<SignalDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/signals/${id}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Signal not found");
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as SignalDetailResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signal");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && signalId) {
      setData(null);
      fetchDetail(signalId);
    } else if (!open) {
      // Reset on close to avoid stale flash next time
      setData(null);
      setError(null);
    }
  }, [open, signalId, fetchDetail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tt-glass-strong border-white/10 max-w-2xl p-0 gap-0 max-h-[88vh] overflow-hidden flex flex-col">
        {loading ? (
          <DetailSkeleton />
        ) : error ? (
          <DetailError error={error} onClose={() => onOpenChange(false)} />
        ) : !data ? (
          <DetailSkeleton />
        ) : (
          <DetailBody data={data} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({
  data,
  onClose,
}: {
  data: SignalDetailResponse;
  onClose: () => void;
}) {
  const { signal, events } = data;
  const digits = digitsFor(signal.symbol);
  const isLong = signal.direction === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const pnl = signal.livePnl ?? signal.closePnl ?? 0;

  const indicatorEntries = entriesOf(signal.indicators);

  return (
    <>
      {/* Header */}
      <DialogHeader className="p-4 border-b border-white/5 shrink-0">
        <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
          <span className="font-bold">{signal.symbol}</span>
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${DIRECTION_BADGE[signal.direction]}`}
          >
            <DirectionIcon className="w-2.5 h-2.5" />
            {signal.direction}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${SIGNAL_TYPE_BADGE[signal.signalType]}`}
          >
            {signal.signalType.replace(/_/g, " ")}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Clock className="w-2.5 h-2.5" />
            {relativeTime(signal.createdAt)}
          </span>
        </DialogTitle>
        <DialogDescription className="text-[11px] text-slate-500">
          Signal ID: <span className="tt-mono">{signal.id}</span>
        </DialogDescription>
      </DialogHeader>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        <div className="p-4 space-y-4">
          {/* Quality ring + key stats */}
          <div className="flex items-center gap-4 rounded-lg border border-white/5 bg-black/20 p-3">
            <QualityRing score={signal.qualityScore} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1 min-w-0">
              <DetailStat
                label="Live PnL"
                value={signedPct(pnl)}
                valueClass={pnlColor(pnl)}
                big
              />
              <DetailStat
                label="Confidence"
                value={`${signal.confidence.toFixed(0)}%`}
              />
              <DetailStat
                label="Probability"
                value={`${signal.expectedProbability.toFixed(0)}%`}
                valueClass="tt-text-up"
              />
              <DetailStat
                label="Risk / Reward"
                value={`1:${signal.riskReward.toFixed(2)}`}
                valueClass="tt-text-accent"
              />
            </div>
          </div>

          {/* Trade setup grid */}
          <section>
            <SectionTitle icon={<Target className="w-3 h-3" />}>
              Trade Setup
            </SectionTitle>
            <div className="grid grid-cols-3 gap-1.5">
              <PriceCell label="Entry" value={formatPrice(signal.entryPrice, digits)} />
              <PriceCell
                label="Current"
                value={formatPrice(signal.currentPrice, digits)}
              />
              <PriceCell
                label="Stop Loss"
                value={formatPrice(signal.stopLoss, digits)}
                valueClass="tt-text-down"
              />
              <PriceCell
                label="TP1"
                value={formatPrice(signal.takeProfit1, digits)}
                valueClass="tt-text-up"
                hit={signal.tp1Hit}
              />
              <PriceCell
                label="TP2"
                value={formatPrice(signal.takeProfit2, digits)}
                valueClass="tt-text-up"
                hit={signal.tp2Hit}
              />
              <PriceCell
                label="TP3"
                value={formatPrice(signal.takeProfit3, digits)}
                valueClass="tt-text-up"
                hit={signal.tp3Hit}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              <MetaCell label="Risk Level" value={signal.riskLevel.toUpperCase()} badgeClass={RISK_BADGE[signal.riskLevel]} />
              <MetaCell label="Session" value={signal.marketSession} />
              <MetaCell label="Duration" value={signal.expectedDuration} />
            </div>
          </section>

          {/* Summary */}
          {signal.summary && (
            <section>
              <SectionTitle icon={<Activity className="w-3 h-3" />}>
                Summary
              </SectionTitle>
              <p className="text-xs text-slate-300 leading-relaxed rounded-md bg-black/20 border border-white/5 p-2.5">
                {signal.summary}
              </p>
            </section>
          )}

          {/* Reasons */}
          {signal.reasons.length > 0 && (
            <section>
              <SectionTitle icon={<Check className="w-3 h-3" />}>
                Reasons
              </SectionTitle>
              <ul className="space-y-1">
                {signal.reasons.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed"
                  >
                    <Check className="w-3 h-3 mt-0.5 tt-text-up shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Indicators */}
          {indicatorEntries.length > 0 && (
            <section>
              <SectionTitle icon={<Gauge className="w-3 h-3" />}>
                Indicators
              </SectionTitle>
              <div className="grid grid-cols-3 gap-1.5">
                {indicatorEntries.map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5"
                  >
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 truncate">
                      {k}
                    </div>
                    <div className="tt-mono text-[11px] font-semibold text-slate-200 truncate">
                      {formatIndicatorValue(v)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Event timeline */}
          <section>
            <SectionTitle icon={<Clock className="w-3 h-3" />}>
              Event Timeline
              <span className="ml-1 text-[10px] text-slate-500 tt-mono">
                ({events.length})
              </span>
            </SectionTitle>
            {events.length === 0 ? (
              <div className="text-xs text-slate-500 rounded-md bg-black/20 border border-white/5 p-3 text-center">
                No events recorded yet.
              </div>
            ) : (
              <EventTimeline events={events} digits={digits} />
            )}
          </section>
        </div>
      </div>

      {/* Footer */}
      <DialogFooter className="p-3 border-t border-white/5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 text-xs"
        >
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

function EventTimeline({
  events,
  digits,
}: {
  events: TradeEvent[];
  digits: number;
}) {
  // Newest first for timeline display
  const ordered = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return (
    <div className="relative pl-5">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
      <ul className="space-y-2.5">
        {ordered.map((ev) => (
          <li key={ev.id} className="relative">
            {/* Dot */}
            <span
              className={`absolute -left-[14px] top-1.5 w-3 h-3 rounded-full ring-2 ${priorityRing(ev.priority)} bg-black flex items-center justify-center`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${priorityColor(ev.priority)}`}
              />
            </span>
            <div className="rounded-md border border-white/5 bg-black/20 p-2 hover:bg-black/30 transition-colors">
              {/* Meta row */}
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span
                  className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase border ${priorityBadgeClass(ev.priority)}`}
                >
                  {priorityLabel(ev.priority)}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500 tt-mono">
                  {eventIcon(ev.type)}
                  {ev.type.replace(/_/g, " ")}
                </span>
                <span className="text-[9px] text-slate-500 tt-mono ml-auto">
                  {formatTime(ev.createdAt)}
                </span>
              </div>
              {/* Title + message */}
              <div className="text-[11px] font-semibold text-slate-100 leading-snug">
                {ev.title}
              </div>
              {ev.message && (
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                  {ev.message}
                </p>
              )}
              {ev.reason && (
                <p className="text-[9px] text-slate-500 mt-1 italic">
                  {ev.reason}
                </p>
              )}
              {typeof ev.confidence === "number" && (
                <div className="text-[9px] text-slate-500 mt-1">
                  Confidence:{" "}
                  <span className="tt-mono text-slate-300">
                    {ev.confidence.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QualityRing({ score }: { score: number }) {
  const v = Math.max(0, Math.min(100, score));
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (v / 100) * circ;
  const color = qualityStroke(v);
  return (
    <div className="relative w-[76px] h-[76px] shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 76 76">
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="5"
        />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`tt-mono text-lg font-bold leading-none ${qualityColor(v)}`}>
          {Math.round(v)}
        </span>
        <span className="text-[7px] uppercase tracking-wider text-slate-500 mt-0.5">
          Quality
        </span>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        {children}
      </span>
    </div>
  );
}

function PriceCell({
  label,
  value,
  valueClass,
  hit,
}: {
  label: string;
  value: string;
  valueClass?: string;
  hit?: boolean;
}) {
  return (
    <div className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
        {label}
        {hit && <Check className="w-2.5 h-2.5 tt-text-up" />}
      </div>
      <div className={`tt-mono text-[11px] font-semibold ${valueClass ?? "text-slate-200"} truncate`}>
        {value}
      </div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  badgeClass,
}: {
  label: string;
  value: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {badgeClass ? (
        <span
          className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase border ${badgeClass} mt-0.5`}
        >
          {value}
        </span>
      ) : (
        <div className="tt-mono text-[10px] font-semibold text-slate-200 truncate">
          {value}
        </div>
      )}
    </div>
  );
}

function DetailStat({
  label,
  value,
  valueClass,
  big,
}: {
  label: string;
  value: string;
  valueClass?: string;
  big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`tt-mono ${big ? "text-xl" : "text-sm"} font-bold truncate ${
          valueClass ?? "text-slate-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function priorityBadgeClass(p: EventPriority): string {
  switch (p) {
    case "critical": return "bg-red-500/15 text-red-400 border-red-500/30";
    case "high": return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    case "medium": return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "low":
    default: return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}

function entriesOf(indicators: Record<string, unknown>): [string, unknown][] {
  if (!indicators || typeof indicators !== "object") return [];
  return Object.entries(indicators).filter(
    ([, v]) => v !== null && v !== undefined
  );
}

function formatIndicatorValue(v: unknown): string {
  if (typeof v === "number") {
    if (!isFinite(v)) return "—";
    if (Math.abs(v) >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (Math.abs(v) >= 100) return v.toFixed(2);
    return v.toFixed(3);
  }
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "yes" : "no";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/5 shrink-0 space-y-2">
        <Skeleton className="h-5 w-48 bg-white/5" />
        <Skeleton className="h-3 w-32 bg-white/5" />
      </div>
      <div className="flex-1 overflow-y-auto tt-scroll p-4 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-[76px] w-[76px] rounded-full bg-white/5" />
          <div className="grid grid-cols-2 gap-2 flex-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 bg-white/5" />
            ))}
          </div>
        </div>
        <Skeleton className="h-20 w-full bg-white/5" />
        <Skeleton className="h-16 w-full bg-white/5" />
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-10 bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-32 w-full bg-white/5" />
      </div>
      <div className="p-3 border-t border-white/5 shrink-0 flex justify-end">
        <Skeleton className="h-8 w-16 bg-white/5" />
      </div>
    </div>
  );
}

function DetailError({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <X className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm text-slate-300">{error}</p>
      <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs">
        Close
      </Button>
    </div>
  );
}

export default SignalDetailDialog;
