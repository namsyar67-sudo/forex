"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Flame,
  Globe,
  Loader2,
  Newspaper,
  Radio,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime, formatTime } from "@/lib/format";

// ---------- Types (mirrors /api/news-intelligence/feed response shape) ----------

interface NewsSentiment {
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  currencies: {
    currency: string;
    impact: "positive" | "negative" | "neutral";
    strength: number;
  }[];
  reasoning: string;
}

interface NewsMarketImpact {
  symbols: {
    symbol: string;
    impact: "bullish" | "bearish" | "neutral";
    strength: number;
    reasoning: string;
  }[];
  overallImpact: "low" | "medium" | "high" | "extreme";
  affectedCategories: string[];
  expectedDuration: "minutes" | "hours" | "session" | "days";
  confidence: number;
}

interface TradeImpactResult {
  affectedTrades: {
    signalId: string;
    symbol: string;
    direction: string;
    currentConfidence: number;
    impactLevel: "low" | "medium" | "high" | "critical";
    recommendation: "hold" | "reduce_risk" | "close" | "move_to_breakeven";
    reasoning: string;
  }[];
  hasCriticalImpact: boolean;
}

interface NewsAISummary {
  headline: string;
  plainLanguageSummary: string;
  keyTakeaways: string[];
  marketImplications: string;
  actionRequired: boolean;
}

interface VerifiedItem {
  title: string;
  summary: string;
  source: string;
  verificationScore: number;
  crossSourceCount: number;
  isVerified: boolean;
  relatedSources: string[];
  symbols: string[];
  publishedAt: string;
}

interface BreakingItem {
  title: string;
  source: string;
  verificationScore: number;
  symbols: string[];
  publishedAt: string;
}

interface ScheduledAlert {
  id: string;
  eventId: string;
  eventTitle: string;
  eventTime: string;
  minutesBefore: number;
  affectedSymbols: string[];
  fired: boolean;
}

interface NewsReport {
  collectedCount: number;
  verifiedCount: number;
  verificationRate: number;
  breakingCount: number;
  sourceCount: number;
  sentiment: NewsSentiment | null;
  marketImpact: NewsMarketImpact | null;
  tradeImpact: TradeImpactResult | null;
  aiSummary: NewsAISummary | null;
  scheduledAlerts: ScheduledAlert[];
  verifiedItems: VerifiedItem[];
  breakingNews: BreakingItem[];
}

interface DecisionRule {
  shouldWait: boolean;
  reason: string;
}

interface FeedResponse {
  report: NewsReport;
  decisionRule: DecisionRule;
  timestamp: number;
}

const REFRESH_MS = 30_000;

// ---------- Helpers ----------

const SENTIMENT_BADGE: Record<string, string> = {
  bullish: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  bearish: "bg-red-500/15 text-red-300 border-red-500/30",
  neutral: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const IMPACT_BADGE: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  extreme: "bg-red-500/20 text-red-300 border-red-500/40",
};

const TRADE_IMPACT_BADGE: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
};

const REC_BADGE: Record<string, string> = {
  hold: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  reduce_risk: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  close: "bg-red-500/20 text-red-300 border-red-500/40",
  move_to_breakeven: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function directionIcon(direction: string) {
  if (direction === "bullish") return <TrendingUp className="w-3 h-3" />;
  if (direction === "bearish") return <TrendingDown className="w-3 h-3" />;
  return <Clock className="w-3 h-3" />;
}

// ---------- Component ----------

export function NewsIntelligencePanel() {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/news-intelligence/feed", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as FeedResponse;
      if (!json?.report) throw new Error("No report in response");
      setData(json);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load news intelligence";
      if (!silent) setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/news-intelligence/feed", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as FeedResponse;
      if (!json?.report) throw new Error("No report in response");
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to run analysis";
      setError(msg);
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const id = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const report = data?.report;
  const decisionRule = data?.decisionRule;
  const busy = refreshing || running;

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Newspaper
            className={`w-4 h-4 text-amber-300 shrink-0 ${
              busy ? "animate-pulse" : "tt-pulse-dot"
            }`}
          />
          <span className="text-sm font-semibold">News Intelligence</span>
          {report && (
            <>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
                · {report.sourceCount} sources
              </span>
              {data?.timestamp && (
                <span className="text-[10px] text-slate-500 truncate">
                  · {relativeTime(new Date(data.timestamp).toISOString())}
                </span>
              )}
            </>
          )}
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={runAnalysis}
          disabled={busy}
          className="h-7 text-xs gap-1.5 shrink-0 bg-amber-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30"
        >
          {running ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          Run Analysis
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="p-6 text-center">
            <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400 mb-3">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchData(false)}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : !report ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No news intelligence data available.
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Decision Rule Banner */}
            {decisionRule && (
              <div
                className={`rounded-lg border p-3 flex items-start gap-2.5 ${
                  decisionRule.shouldWait
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-emerald-500/10 border-emerald-500/30"
                }`}
              >
                {decisionRule.shouldWait ? (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold ${
                        decisionRule.shouldWait ? "text-red-300" : "text-emerald-300"
                      }`}
                    >
                      {decisionRule.shouldWait ? "WAIT" : "CLEAR"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Decision Rule
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-0.5 ${
                      decisionRule.shouldWait ? "text-red-200" : "text-emerald-200"
                    }`}
                  >
                    {decisionRule.shouldWait
                      ? decisionRule.reason
                      : "Conditions clear — news flow stable"}
                  </p>
                </div>
              </div>
            )}

            {/* AI Summary Card */}
            {report.aiSummary && (
              <AISummaryCard summary={report.aiSummary} />
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile
                label="Collected"
                value={report.collectedCount}
                icon={<Newspaper className="w-3 h-3" />}
              />
              <StatTile
                label="Verified"
                value={`${report.verifiedCount} (${report.verificationRate}%)`}
                icon={<Shield className="w-3 h-3" />}
                accent={
                  report.verificationRate >= 70
                    ? "up"
                    : report.verificationRate >= 40
                    ? "accent"
                    : "down"
                }
              />
              <StatTile
                label="Breaking"
                value={report.breakingCount}
                icon={<Flame className="w-3 h-3" />}
                accent={report.breakingCount > 0 ? "down" : undefined}
              />
              <StatTile
                label="Sources"
                value={report.sourceCount}
                icon={<Globe className="w-3 h-3" />}
              />
            </div>

            {/* Sentiment Card */}
            {report.sentiment && <SentimentCard sentiment={report.sentiment} />}

            {/* Market Impact Card */}
            {report.marketImpact && (
              <MarketImpactCard impact={report.marketImpact} />
            )}

            {/* Trade Impact Card */}
            {report.tradeImpact && (
              <TradeImpactCard impact={report.tradeImpact} />
            )}

            {/* Breaking News Section */}
            {report.breakingNews.length > 0 && (
              <BreakingNewsSection items={report.breakingNews} />
            )}

            {/* Verified News List */}
            <VerifiedNewsList items={report.verifiedItems} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Subcomponents ----------

function StatTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: "up" | "down" | "accent" | "dim";
}) {
  const accentClass =
    accent === "up"
      ? "tt-text-up"
      : accent === "down"
      ? "tt-text-down"
      : accent === "accent"
      ? "tt-text-accent"
      : accent === "dim"
      ? "tt-text-dim"
      : "text-slate-200";
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`tt-mono text-base font-semibold mt-1 ${accentClass}`}>
        {value}
      </div>
    </div>
  );
}

function AISummaryCard({ summary }: { summary: NewsAISummary }) {
  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
        <span className="text-[10px] uppercase tracking-wider text-violet-300/80">
          AI Summary
        </span>
        {summary.actionRequired && (
          <span className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-red-500/15 text-red-300 border-red-500/30">
            Action Required
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-100 leading-snug mb-1.5">
        {summary.headline}
      </h3>
      <p className="text-xs text-slate-400 leading-relaxed mb-2">
        {summary.plainLanguageSummary}
      </p>
      {summary.keyTakeaways.length > 0 && (
        <ul className="space-y-1 mb-2">
          {summary.keyTakeaways.map((k, i) => (
            <li
              key={i}
              className="text-xs text-slate-300 leading-relaxed flex gap-1.5"
            >
              <span className="text-violet-400 mt-0.5">▸</span>
              <span>{k}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 pt-2 border-t border-white/5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          Implications
        </span>
        <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
          {summary.marketImplications}
        </p>
      </div>
    </div>
  );
}

function SentimentCard({ sentiment }: { sentiment: NewsSentiment }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-sky-300" />
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Sentiment
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              SENTIMENT_BADGE[sentiment.direction] ?? SENTIMENT_BADGE.neutral
            }`}
          >
            {directionIcon(sentiment.direction)}
            {sentiment.direction}
          </span>
          <span className="tt-mono text-[11px] text-slate-300">
            {sentiment.confidence}%
          </span>
        </div>
      </div>

      {sentiment.currencies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {sentiment.currencies.map((c) => (
            <span
              key={c.currency}
              className={`inline-flex items-center gap-1 tt-mono text-[10px] px-1.5 py-0.5 rounded border ${
                c.impact === "positive"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : c.impact === "negative"
                  ? "bg-red-500/15 text-red-300 border-red-500/30"
                  : "bg-slate-500/15 text-slate-300 border-slate-500/30"
              }`}
            >
              {c.currency} · {c.strength}
            </span>
          ))}
        </div>
      )}

      {sentiment.reasoning && (
        <p className="text-[11px] text-slate-500 leading-relaxed italic">
          {sentiment.reasoning}
        </p>
      )}
    </div>
  );
}

function MarketImpactCard({ impact }: { impact: NewsMarketImpact }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Market Impact
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              IMPACT_BADGE[impact.overallImpact] ?? IMPACT_BADGE.low
            }`}
          >
            {impact.overallImpact}
          </span>
          <span className="tt-mono text-[11px] text-slate-300">
            {impact.confidence}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 text-[10px]">
        <div>
          <div className="uppercase tracking-wider text-slate-500 mb-0.5">
            Duration
          </div>
          <div className="text-xs text-slate-300 capitalize">
            {impact.expectedDuration}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-slate-500 mb-0.5">
            Categories
          </div>
          <div className="text-xs text-slate-300 truncate">
            {impact.affectedCategories.length > 0
              ? impact.affectedCategories.join(", ")
              : "—"}
          </div>
        </div>
      </div>

      {impact.symbols.length > 0 && (
        <div className="space-y-1.5">
          {impact.symbols.slice(0, 6).map((s) => (
            <div key={s.symbol} className="flex items-center gap-2">
              <span className="tt-mono text-[11px] text-slate-200 w-16 shrink-0">
                {s.symbol}
              </span>
              <span
                className={`shrink-0 ${
                  s.impact === "bullish"
                    ? "tt-text-up"
                    : s.impact === "bearish"
                    ? "tt-text-down"
                    : "tt-text-dim"
                }`}
              >
                {directionIcon(s.impact)}
              </span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    s.impact === "bullish"
                      ? "bg-emerald-500"
                      : s.impact === "bearish"
                      ? "bg-red-500"
                      : "bg-slate-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, s.strength))}%` }}
                />
              </div>
              <span className="tt-mono text-[10px] text-slate-400 w-8 text-right">
                {s.strength}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TradeImpactCard({ impact }: { impact: TradeImpactResult }) {
  const hasAffected = impact.affectedTrades.length > 0;
  return (
    <div
      className={`rounded-lg border p-3 ${
        impact.hasCriticalImpact
          ? "border-red-500/40 bg-red-500/[0.06]"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-sky-300" />
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Trade Impact
          </span>
        </div>
        {impact.hasCriticalImpact && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-red-500/20 text-red-300 border-red-500/40">
            Critical
          </span>
        )}
      </div>

      {!hasAffected ? (
        <p className="text-xs text-slate-500 italic">
          No open trades affected by current news.
        </p>
      ) : (
        <div className="space-y-2">
          {impact.affectedTrades.map((t) => (
            <div
              key={t.signalId}
              className="rounded-md border border-white/5 bg-black/20 p-2"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="tt-mono text-xs font-semibold text-slate-100">
                  {t.symbol}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {t.direction}
                </span>
                <span
                  className={`ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    TRADE_IMPACT_BADGE[t.impactLevel] ?? TRADE_IMPACT_BADGE.low
                  }`}
                >
                  {t.impactLevel}
                </span>
                <span
                  className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    REC_BADGE[t.recommendation] ?? REC_BADGE.hold
                  }`}
                >
                  {t.recommendation.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {t.reasoning}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakingNewsSection({ items }: { items: BreakingItem[] }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-red-500/20">
        <Flame className="w-3.5 h-3.5 text-red-400" />
        <span className="text-[10px] uppercase tracking-wider text-red-300 font-semibold">
          Breaking News
        </span>
        <span className="tt-mono text-[10px] text-slate-500 ml-auto">
          {items.length}
        </span>
      </div>
      <ul className="divide-y divide-red-500/10">
        {items.map((n, i) => (
          <li
            key={i}
            className="px-3 py-2 border-l-2 border-red-500/60 flex items-start gap-2"
          >
            <span className="relative flex h-2 w-2 mt-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-100 leading-snug">
                {n.title}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] text-slate-500">{n.source}</span>
                <span className="text-[10px] text-slate-600">·</span>
                <span className="tt-mono text-[10px] text-amber-300">
                  score {n.verificationScore}
                </span>
                <span className="text-[10px] text-slate-600">·</span>
                <span className="tt-mono text-[10px] text-slate-500">
                  {relativeTime(n.publishedAt)}
                </span>
                {n.symbols.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="tt-mono text-[10px] px-1 py-0.5 rounded border bg-white/5 text-slate-400 border-white/10"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerifiedNewsList({ items }: { items: VerifiedItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <Newspaper className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Verified News
        </span>
        <span className="tt-mono text-[10px] text-slate-500 ml-auto">
          {items.length}
        </span>
      </div>
      <ul className="divide-y divide-white/5">
        {items.map((item, i) => (
          <li
            key={i}
            className={`p-3 ${item.isVerified ? "" : "opacity-60"}`}
          >
            <div className="flex items-start gap-2 mb-1">
              <h4 className="text-xs font-semibold text-slate-100 leading-snug flex-1">
                {item.title}
              </h4>
              {!item.isVerified && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30 shrink-0">
                  Unverified
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-1.5">
              {item.summary}
            </p>

            {/* Verification score bar */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
                Score
              </span>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${scoreColor(
                    item.verificationScore
                  )}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, item.verificationScore))}%`,
                  }}
                />
              </div>
              <span className="tt-mono text-[10px] text-slate-400 w-7 text-right">
                {item.verificationScore}
              </span>
            </div>

            {/* Footer: source, cross-source count, related, symbols, time */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400">{item.source}</span>
              {item.crossSourceCount > 1 && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-sky-500/15 text-sky-300 border-sky-500/30">
                  {item.crossSourceCount} sources
                </span>
              )}
              {item.relatedSources.slice(0, 2).map((r, idx) => (
                <span
                  key={idx}
                  className="text-[10px] text-slate-500 px-1 py-0.5 rounded bg-white/[0.03] border border-white/5"
                >
                  {r}
                </span>
              ))}
              {item.symbols.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="tt-mono text-[10px] px-1 py-0.5 rounded border bg-white/5 text-slate-400 border-white/10"
                >
                  {s}
                </span>
              ))}
              <span className="tt-mono text-[10px] text-slate-500 ml-auto">
                {relativeTime(item.publishedAt)} · {formatTime(item.publishedAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Loading skeleton ----------

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {/* Decision banner skeleton */}
      <Skeleton className="h-14 w-full bg-white/5" />
      {/* AI summary skeleton */}
      <Skeleton className="h-32 w-full bg-white/5" />
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/5" />
        ))}
      </div>
      {/* Sentiment + market impact skeletons */}
      <Skeleton className="h-24 w-full bg-white/5" />
      <Skeleton className="h-36 w-full bg-white/5" />
      {/* Verified list skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full bg-white/5" />
        ))}
      </div>
    </div>
  );
}

export default NewsIntelligencePanel;
