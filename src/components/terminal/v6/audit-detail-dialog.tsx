"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Flame,
  Gauge,
  Loader2,
  Newspaper,
  Radio,
  Save,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { relativeTime, formatTime } from "@/lib/format";

// ---------- Types (mirrors /api/audit/[id] response shape) ----------

type Decision = "BUY" | "SELL" | "HOLD" | "WAIT";
type Outcome = "win" | "loss" | "expired" | "invalidated" | "still_active" | null;

interface AgentFactor {
  name: string;
  value: string;
  impact: "positive" | "negative" | "neutral";
  weight?: number;
}

interface AgentReport {
  agent: string;
  symbol?: string;
  recommendation: string;
  confidence: number;
  score: number;
  weight?: number;
  summary: string;
  factors: AgentFactor[];
  data?: Record<string, unknown>;
  timestamp?: number;
}

interface NewsItem {
  title?: string;
  headline?: string;
  summary?: string;
  source?: string;
  publishedAt?: string;
  impact?: string;
  sentiment?: string;
  verificationScore?: number;
  symbols?: string[];
  [k: string]: unknown;
}

interface AuditDetail {
  id: string;
  signalId: string | null;
  symbol: string;
  decision: string;
  confidence: number;
  qualityScore: number;
  direction: string;
  reasoning: string;
  agentReports: AgentReport[];
  factorsSummary: Record<string, unknown>;
  dataSnapshot: Record<string, unknown>;
  newsSnapshot: NewsItem[] | null;
  calendarSnapshot: unknown[] | null;
  sentimentSnapshot: Record<string, unknown> | null;
  influencingNews: NewsItem[] | null;
  breakingNewsAtDecision: NewsItem[] | null;
  postDecisionEvents: unknown[] | null;
  // Latency
  newsArrivalLatency: number | null;
  processingLatency: number | null;
  reanalysisLatency: number | null;
  notificationLatency: number | null;
  totalLatency: number | null;
  // Outcome
  outcomeTracked: boolean;
  finalOutcome: Outcome;
  outcomePrice: number | null;
  outcomePnl: number | null;
  outcomeReason: string | null;
  confidenceChange: number | null;
  resolvedAt: string | null;
  // Meta
  decisionTime: string;
  createdAt: string;
}

interface DetailResponse {
  audit: AuditDetail;
  time: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditId: string | null;
}

// ---------- Styling ----------

const DECISION_BADGE: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  SELL: "bg-red-500/15 text-red-400 border-red-500/30",
  HOLD: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  WAIT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const OUTCOME_META: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
  win: {
    class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: <CheckCircle className="w-3 h-3" />,
    label: "WIN",
  },
  loss: {
    class: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: <X className="w-3 h-3" />,
    label: "LOSS",
  },
  expired: {
    class: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    icon: <Clock className="w-3 h-3" />,
    label: "EXPIRED",
  },
  invalidated: {
    class: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "INVALIDATED",
  },
  still_active: {
    class: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    icon: <Activity className="w-3 h-3" />,
    label: "STILL ACTIVE",
  },
};

const RECOMMENDATION_BADGE: Record<string, string> = {
  BUY: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  SELL: "bg-red-500/10 text-red-400 border-red-500/20",
  HOLD: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  WAIT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

// ---------- Helpers ----------

function latencyColor(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "text-slate-500";
  if (ms < 1000) return "tt-text-up";
  if (ms < 5000) return "tt-text-accent";
  return "tt-text-down";
}

function latencyBg(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "bg-slate-500/10 border-slate-500/20";
  if (ms < 1000) return "bg-emerald-500/5 border-emerald-500/20";
  if (ms < 5000) return "bg-amber-500/5 border-amber-500/20";
  return "bg-red-500/5 border-red-500/20";
}

function latencyFormat(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
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

function qualityColor(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function impactBadge(impact: string): string {
  switch ((impact || "").toLowerCase()) {
    case "positive":
    case "bullish":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "negative":
    case "bearish":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
}

function safeString(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") {
    if (!isFinite(v)) return "—";
    if (Math.abs(v) >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (Math.abs(v) >= 100) return v.toFixed(2);
    return v.toFixed(3);
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function safeArray<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

// ---------- Component ----------

export function AuditDetailDialog({ open, onOpenChange, auditId }: Props) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit/${id}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Audit not found");
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as DetailResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load audit");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && auditId) {
      setData(null);
      fetchDetail(auditId);
    } else if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, auditId, fetchDetail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tt-glass-strong border-white/10 max-w-3xl p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        {loading ? (
          <DialogSkeleton />
        ) : error ? (
          <DialogError error={error} onClose={() => onOpenChange(false)} />
        ) : !data ? (
          <DialogSkeleton />
        ) : (
          <DialogBody
            data={data}
            onClose={() => onOpenChange(false)}
            onResolved={() => auditId && fetchDetail(auditId)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Body ----------

function DialogBody({
  data,
  onClose,
  onResolved,
}: {
  data: DetailResponse;
  onClose: () => void;
  onResolved: () => void;
}) {
  const { audit } = data;
  const decision = (audit.decision || "HOLD").toUpperCase();
  const decisionClass =
    DECISION_BADGE[decision] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30";
  const isLong = (audit.direction || "").toLowerCase() === "long";
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;
  const outcomeMeta = audit.finalOutcome ? OUTCOME_META[audit.finalOutcome] : null;

  return (
    <>
      {/* Header */}
      <DialogHeader className="p-4 border-b border-white/5 shrink-0">
        <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
          <span className="font-bold tt-mono">{audit.symbol}</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${decisionClass}`}
          >
            {decision}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
              isLong
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
          >
            <DirectionIcon className="w-2.5 h-2.5" />
            {(audit.direction || "—").toUpperCase()}
          </span>
          {outcomeMeta && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${outcomeMeta.class}`}
            >
              {outcomeMeta.icon}
              {outcomeMeta.label}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Clock className="w-2.5 h-2.5" />
            {relativeTime(audit.decisionTime)}
          </span>
        </DialogTitle>
        <DialogDescription className="text-[11px] text-slate-500">
          Audit ID: <span className="tt-mono">{audit.id}</span>
          {audit.signalId && (
            <>
              {" · "}
              Signal: <span className="tt-mono">{audit.signalId}</span>
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        <div className="p-4 space-y-4">
          {/* Key stats */}
          <div className="grid grid-cols-4 gap-1.5">
            <StatCell label="Confidence" value={`${Math.round(audit.confidence)}%`} />
            <StatCell
              label="Quality"
              value={String(Math.round(audit.qualityScore))}
              valueClass={qualityColor(audit.qualityScore)}
            />
            <StatCell
              label="Total Latency"
              value={latencyFormat(audit.totalLatency)}
              valueClass={latencyColor(audit.totalLatency)}
            />
            <StatCell
              label="Decision Time"
              value={formatTime(audit.decisionTime)}
            />
          </div>

          {/* Outcome */}
          <OutcomeSection audit={audit} />

          {/* Latency */}
          <LatencySection audit={audit} />

          {/* Why was it issued? */}
          <section>
            <SectionTitle icon={<Sparkles className="w-3 h-3" />}>
              Why was it issued?
            </SectionTitle>
            {audit.reasoning ? (
              <pre className="text-[11px] tt-mono text-slate-300 leading-relaxed whitespace-pre-wrap font-mono rounded-md bg-black/30 border border-white/5 p-2.5 max-h-48 overflow-y-auto tt-scroll">
                {audit.reasoning}
              </pre>
            ) : (
              <EmptyBlock text="No reasoning recorded." />
            )}

            {safeArray(audit.agentReports).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                {safeArray(audit.agentReports).map((r, i) => (
                  <AgentReportCard key={`${r.agent}-${i}`} report={r} />
                ))}
              </div>
            )}
          </section>

          {/* What data was used? */}
          <section>
            <SectionTitle icon={<Database className="w-3 h-3" />}>
              What data was used?
            </SectionTitle>
            <DataSnapshotGrid snapshot={audit.dataSnapshot} />
            {safeArray(audit.newsSnapshot).length > 0 && (
              <NewsList
                items={safeArray(audit.newsSnapshot)}
                title="News Snapshot"
                icon={<Newspaper className="w-3 h-3" />}
              />
            )}
            {audit.sentimentSnapshot && (
              <SentimentBlock sentiment={audit.sentimentSnapshot} />
            )}
          </section>

          {/* What news affected it? */}
          {(safeArray(audit.influencingNews).length > 0 ||
            safeArray(audit.breakingNewsAtDecision).length > 0) && (
            <section>
              <SectionTitle icon={<Newspaper className="w-3 h-3" />}>
                What news affected it?
              </SectionTitle>
              {safeArray(audit.breakingNewsAtDecision).length > 0 && (
                <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2 mb-2">
                  <div className="flex items-center gap-1 mb-1.5 text-[10px] uppercase tracking-wider text-red-400 font-semibold">
                    <Flame className="w-3 h-3" />
                    Breaking News at Decision
                  </div>
                  <NewsList items={safeArray(audit.breakingNewsAtDecision)} flat />
                </div>
              )}
              {safeArray(audit.influencingNews).length > 0 && (
                <NewsList items={safeArray(audit.influencingNews)} flat />
              )}
            </section>
          )}

          {/* What changed afterward? */}
          <section>
            <SectionTitle icon={<Activity className="w-3 h-3" />}>
              What changed afterward?
            </SectionTitle>
            <PostDecisionSection audit={audit} />
          </section>

          {/* Manual resolve form */}
          {!audit.outcomeTracked && (
            <ManualResolveForm auditId={audit.id} onResolved={onResolved} />
          )}
        </div>
      </div>

      {/* Footer */}
      <DialogFooter className="p-3 border-t border-white/5 shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------- Sections ----------

function OutcomeSection({ audit }: { audit: AuditDetail }) {
  if (!audit.outcomeTracked) {
    return (
      <section>
        <SectionTitle icon={<Clock className="w-3 h-3" />}>
          Outcome
        </SectionTitle>
        <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-2.5 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
          <span className="text-xs text-sky-300">
            Pending — tracking outcome
          </span>
        </div>
      </section>
    );
  }
  const meta = audit.finalOutcome ? OUTCOME_META[audit.finalOutcome] : null;
  return (
    <section>
      <SectionTitle icon={<CheckCircle className="w-3 h-3" />}>
        Outcome
      </SectionTitle>
      <div className="rounded-md border border-white/5 bg-black/20 p-2.5 space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {meta && (
            <div>
              <Label className="text-[9px] uppercase tracking-wider text-slate-500">
                Result
              </Label>
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${meta.class}`}
              >
                {meta.icon}
                {meta.label}
              </span>
            </div>
          )}
          <div>
            <Label className="text-[9px] uppercase tracking-wider text-slate-500">
              PnL
            </Label>
            <div className={`tt-mono text-sm font-bold ${pnlColor(audit.outcomePnl)}`}>
              {signedPnl(audit.outcomePnl)}
            </div>
          </div>
          <div>
            <Label className="text-[9px] uppercase tracking-wider text-slate-500">
              Conf Δ
            </Label>
            <div
              className={`tt-mono text-sm font-bold ${
                audit.confidenceChange === null
                  ? "text-slate-500"
                  : audit.confidenceChange > 0
                  ? "tt-text-up"
                  : audit.confidenceChange < 0
                  ? "tt-text-down"
                  : "tt-text-dim"
              }`}
            >
              {audit.confidenceChange === null
                ? "—"
                : `${audit.confidenceChange > 0 ? "+" : ""}${audit.confidenceChange.toFixed(0)}%`}
            </div>
          </div>
          <div>
            <Label className="text-[9px] uppercase tracking-wider text-slate-500">
              Resolved
            </Label>
            <div className="text-[11px] text-slate-300">
              {audit.resolvedAt ? relativeTime(audit.resolvedAt) : "—"}
            </div>
          </div>
        </div>
        {audit.outcomeReason && (
          <div>
            <Label className="text-[9px] uppercase tracking-wider text-slate-500">
              Reason
            </Label>
            <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
              {audit.outcomeReason}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function LatencySection({ audit }: { audit: AuditDetail }) {
  const items: { label: string; value: number | null; icon: React.ReactNode }[] = [
    { label: "News Arrival", value: audit.newsArrivalLatency, icon: <Radio className="w-2.5 h-2.5" /> },
    { label: "Processing", value: audit.processingLatency, icon: <Cpu className="w-2.5 h-2.5" /> },
    { label: "Reanalysis", value: audit.reanalysisLatency, icon: <Activity className="w-2.5 h-2.5" /> },
    { label: "Notification", value: audit.notificationLatency, icon: <Zap className="w-2.5 h-2.5" /> },
    { label: "Total", value: audit.totalLatency, icon: <Clock className="w-2.5 h-2.5" /> },
  ];
  return (
    <section>
      <SectionTitle icon={<Gauge className="w-3 h-3" />}>
        Latency Breakdown
      </SectionTitle>
      <div className="grid grid-cols-5 gap-1.5">
        {items.map((it) => (
          <div
            key={it.label}
            className={`rounded-md border px-2 py-1.5 ${latencyBg(it.value)}`}
          >
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
              <span className="text-slate-500">{it.icon}</span>
              <span className="truncate">{it.label}</span>
            </div>
            <div className={`tt-mono text-sm font-bold ${latencyColor(it.value)}`}>
              {latencyFormat(it.value)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentReportCard({ report }: { report: AgentReport }) {
  const rec = (report.recommendation || "HOLD").toUpperCase();
  const recClass =
    RECOMMENDATION_BADGE[rec] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
  const factors = safeArray(report.factors).slice(0, 4);
  return (
    <div className="rounded-md border border-white/5 bg-black/20 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-100 capitalize">
          {report.agent}
        </span>
        <span
          className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase border ${recClass}`}
        >
          {rec}
        </span>
        <span className="ml-auto tt-mono text-[10px] text-slate-400">
          {Math.round(report.confidence)}%
        </span>
      </div>
      {report.summary && (
        <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
          {report.summary}
        </p>
      )}
      <div className="flex items-center gap-2 text-[9px] text-slate-500">
        <span>
          score:{" "}
          <span
            className={`tt-mono ${
              report.score > 0 ? "tt-text-up" : report.score < 0 ? "tt-text-down" : ""
            }`}
          >
            {report.score > 0 ? "+" : ""}
            {report.score?.toFixed(0) ?? "—"}
          </span>
        </span>
        {typeof report.weight === "number" && (
          <span>
            weight: <span className="tt-mono">{report.weight.toFixed(2)}</span>
          </span>
        )}
      </div>
      {factors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {factors.map((f, i) => (
            <span
              key={i}
              className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] border ${impactBadge(
                f.impact || ""
              )}`}
            >
              {f.name}: {f.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DataSnapshotGrid({ snapshot }: { snapshot: Record<string, unknown> }) {
  const knownKeys = [
    "price",
    "rsi",
    "adx",
    "atr",
    "macd",
    "trend",
    "signal",
    "smcBias",
    "smcStructure",
    "mtfAlignment",
    "premiumDiscount",
    "premiumDiscountLabel",
  ];
  // Include known keys if present, plus any extras (max 12 total)
  const entries: [string, unknown][] = [];
  for (const k of knownKeys) {
    if (snapshot && snapshot[k] !== undefined && snapshot[k] !== null) {
      entries.push([k, snapshot[k]]);
    }
  }
  for (const [k, v] of Object.entries(snapshot || {})) {
    if (knownKeys.includes(k)) continue;
    if (v === null || v === undefined) continue;
    entries.push([k, v]);
    if (entries.length >= 12) break;
  }

  if (entries.length === 0) {
    return <EmptyBlock text="No data snapshot recorded." />;
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5"
        >
          <div className="text-[9px] uppercase tracking-wider text-slate-500 truncate">
            {k}
          </div>
          <div className="tt-mono text-[11px] font-semibold text-slate-200 truncate">
            {safeString(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsList({
  items,
  title,
  icon,
  flat,
}: {
  items: NewsItem[];
  title?: string;
  icon?: React.ReactNode;
  flat?: boolean;
}) {
  const inner = (
    <div className={flat ? "space-y-1" : "space-y-1.5"}>
      {items.map((n, i) => (
        <NewsItemRow key={i} item={n} />
      ))}
    </div>
  );
  if (!title) return inner;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1 mb-1 text-[10px] uppercase tracking-wider text-slate-500">
        {icon}
        {title}
        <span className="tt-mono">({items.length})</span>
      </div>
      {inner}
    </div>
  );
}

function NewsItemRow({ item }: { item: NewsItem }) {
  const title = item.title || item.headline || "Untitled";
  const source = item.source || "—";
  const publishedAt = item.publishedAt;
  return (
    <div className="rounded-md border border-white/5 bg-black/20 p-2">
      <div className="flex items-start gap-1.5">
        <Newspaper className="w-2.5 h-2.5 text-slate-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-slate-100 leading-snug">
            {title}
          </div>
          {item.summary && (
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
              {item.summary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[9px] text-slate-500">
            <span>{source}</span>
            {publishedAt && (
              <span className="tt-mono">{formatTime(publishedAt)}</span>
            )}
            {item.impact && (
              <span
                className={`inline-flex items-center px-1 py-0.5 rounded border ${impactBadge(
                  item.impact
                )}`}
              >
                {item.impact}
              </span>
            )}
            {typeof item.verificationScore === "number" && (
              <span className="tt-mono">
                v:{Math.round(item.verificationScore)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SentimentBlock({ sentiment }: { sentiment: Record<string, unknown> }) {
  const direction = safeString(sentiment.direction);
  const confidence = sentiment.confidence;
  const reasoning = safeString(sentiment.reasoning);
  return (
    <div className="mt-2 rounded-md border border-white/5 bg-black/20 p-2">
      <div className="flex items-center gap-1 mb-1 text-[10px] uppercase tracking-wider text-slate-500">
        <Sparkles className="w-3 h-3" />
        Sentiment Snapshot
      </div>
      <div className="grid grid-cols-2 gap-2 mb-1.5">
        <div>
          <Label className="text-[9px] uppercase tracking-wider text-slate-500">
            Direction
          </Label>
          <div className="text-[11px] font-semibold capitalize text-slate-200">
            {direction}
          </div>
        </div>
        <div>
          <Label className="text-[9px] uppercase tracking-wider text-slate-500">
            Confidence
          </Label>
          <div className="tt-mono text-[11px] font-semibold text-slate-200">
            {typeof confidence === "number" ? `${Math.round(confidence)}%` : "—"}
          </div>
        </div>
      </div>
      {reasoning && reasoning !== "—" && (
        <p className="text-[10px] text-slate-400 leading-relaxed">{reasoning}</p>
      )}
    </div>
  );
}

function PostDecisionSection({ audit }: { audit: AuditDetail }) {
  const events = safeArray(audit.postDecisionEvents as unknown[]);
  if (!audit.outcomeTracked && events.length === 0) {
    return (
      <EmptyBlock text="No post-decision events yet. Outcome is still being tracked." />
    );
  }
  return (
    <div className="space-y-2">
      {events.length > 0 ? (
        <div className="relative pl-5">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
          <ul className="space-y-2">
            {events.map((ev, i) => (
              <PostEventRow key={i} event={ev} />
            ))}
          </ul>
        </div>
      ) : (
        <EmptyBlock text="No post-decision events recorded." />
      )}
      <div className="rounded-md border border-white/5 bg-black/20 p-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[9px] uppercase tracking-wider text-slate-500">
              Confidence Change
            </Label>
            <div
              className={`tt-mono text-sm font-bold ${
                audit.confidenceChange === null
                  ? "text-slate-500"
                  : audit.confidenceChange > 0
                  ? "tt-text-up"
                  : audit.confidenceChange < 0
                  ? "tt-text-down"
                  : "tt-text-dim"
              }`}
            >
              {audit.confidenceChange === null
                ? "—"
                : `${audit.confidenceChange > 0 ? "+" : ""}${audit.confidenceChange.toFixed(0)}%`}
            </div>
          </div>
          <div>
            <Label className="text-[9px] uppercase tracking-wider text-slate-500">
              Final Outcome
            </Label>
            <div className="text-[11px] font-semibold text-slate-200 capitalize">
              {audit.finalOutcome
                ? audit.finalOutcome.replace(/_/g, " ")
                : "Pending"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostEventRow({ event }: { event: unknown }) {
  const obj = (event || {}) as Record<string, unknown>;
  const title = safeString(obj.title || obj.type || obj.event);
  const message = safeString(obj.message || obj.reason || obj.summary);
  const ts =
    typeof obj.timestamp === "string"
      ? obj.timestamp
      : typeof obj.createdAt === "string"
      ? obj.createdAt
      : null;
  return (
    <li className="relative">
      <span className="absolute -left-[14px] top-1.5 w-3 h-3 rounded-full bg-black ring-2 ring-sky-500/40 flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
      </span>
      <div className="rounded-md border border-white/5 bg-black/20 p-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-100 leading-snug">
            {title}
          </span>
          {ts && (
            <span className="ml-auto text-[9px] text-slate-500 tt-mono">
              {formatTime(ts)}
            </span>
          )}
        </div>
        {message && message !== "—" && (
          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
            {message}
          </p>
        )}
      </div>
    </li>
  );
}

function ManualResolveForm({
  auditId,
  onResolved,
}: {
  auditId: string;
  onResolved: () => void;
}) {
  const [outcome, setOutcome] = useState<"win" | "loss" | "expired">("expired");
  const [pnl, setPnl] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const body: Record<string, unknown> = {
          finalOutcome: outcome,
          outcomeReason: reason || undefined,
        };
        if (pnl !== "") {
          const parsed = parseFloat(pnl);
          if (!isFinite(parsed)) throw new Error("Invalid PnL value");
          body.outcomePnl = parsed;
        }
        const res = await fetch(`/api/audit/${auditId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Audit resolved");
        onResolved();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to resolve audit";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [auditId, outcome, pnl, reason, onResolved]
  );

  return (
    <section>
      <SectionTitle icon={<Save className="w-3 h-3" />}>
        Manual Resolve
      </SectionTitle>
      <form
        onSubmit={handleSubmit}
        className="rounded-md border border-white/5 bg-black/20 p-2.5 space-y-2"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[9px] uppercase tracking-wider text-slate-500">
              Outcome
            </Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as any)}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="win">Win</SelectItem>
                <SelectItem value="loss">Loss</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[9px] uppercase tracking-wider text-slate-500">
              PnL
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 1.5 or -0.8"
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              className="h-8 text-xs tt-mono"
            />
          </div>
        </div>
        <div>
          <Label className="text-[9px] uppercase tracking-wider text-slate-500">
            Reason
          </Label>
          <Input
            type="text"
            placeholder="Optional reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={submitting}
          className="h-8 text-xs w-full gap-1.5"
        >
          {submitting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle className="w-3 h-3" />
          )}
          Resolve Audit
        </Button>
      </form>
    </section>
  );
}

// ---------- Shared primitives ----------

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

function StatCell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-white/5 bg-black/30 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`tt-mono text-sm font-bold truncate ${valueClass ?? "text-slate-200"}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="text-[11px] text-slate-500 rounded-md bg-black/20 border border-white/5 p-2.5 text-center">
      {text}
    </div>
  );
}

function DialogSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/5 shrink-0 space-y-2">
        <Skeleton className="h-5 w-48 bg-white/5" />
        <Skeleton className="h-3 w-64 bg-white/5" />
      </div>
      <div className="flex-1 overflow-y-auto tt-scroll p-4 space-y-3">
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-20 w-full bg-white/5" />
        <Skeleton className="h-24 w-full bg-white/5" />
        <Skeleton className="h-32 w-full bg-white/5" />
        <Skeleton className="h-24 w-full bg-white/5" />
      </div>
      <div className="p-3 border-t border-white/5 shrink-0 flex justify-end">
        <Skeleton className="h-8 w-16 bg-white/5" />
      </div>
    </div>
  );
}

function DialogError({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm text-slate-300">{error}</p>
      <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs">
        Close
      </Button>
    </div>
  );
}

export default AuditDetailDialog;
