"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Zap,
  Clock,
  Newspaper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime, categoryColor } from "@/lib/format";

/* ---------- Types (mirror /api/news-impact -> lib/news-impact/engine) ---------- */
interface NewsImpactResult {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: string;
  impactScore: number; // 0..100
  affectedSymbols: string[];
  expectedDuration: string; // "minutes" | "hours" | "session" | "days"
  riskLevel: "low" | "medium" | "high" | "extreme";
  confidence: number; // 0..100
  reasoning: string;
}

interface NewsImpactResponse {
  items: NewsImpactResult[];
  highImpactCount: number;
  topRiskSymbols: { symbol: string; risk: number }[];
}

const REFRESH_INTERVAL = 60_000;

function impactBarColor(score: number): string {
  if (score > 75) return "rgba(239, 68, 68, 0.9)";
  if (score >= 55) return "rgba(249, 115, 22, 0.85)";
  if (score >= 35) return "rgba(245, 158, 11, 0.8)";
  return "rgba(100, 116, 139, 0.7)";
}

function riskBadgeClass(risk: NewsImpactResult["riskLevel"]): string {
  switch (risk) {
    case "extreme":
      return "text-red-300 bg-red-500/15 border-red-500/30";
    case "high":
      return "text-orange-300 bg-orange-500/15 border-orange-500/30";
    case "medium":
      return "text-amber-300 bg-amber-500/15 border-amber-500/30";
    case "low":
      return "text-slate-400 bg-slate-500/15 border-slate-500/30";
  }
}

function riskSymbolColor(risk: number): string {
  if (risk >= 75) return "text-red-300 bg-red-500/15 border-red-500/30";
  if (risk >= 50) return "text-orange-300 bg-orange-500/15 border-orange-500/30";
  if (risk >= 25) return "text-amber-300 bg-amber-500/15 border-amber-500/30";
  return "text-slate-400 bg-slate-500/15 border-slate-500/30";
}

function NewsItemSkeleton() {
  return (
    <div className="p-3 border-b border-white/5 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-12 bg-white/5" />
        <Skeleton className="h-3 w-14 bg-white/5" />
        <Skeleton className="h-2 w-10 bg-white/5 ml-auto" />
      </div>
      <Skeleton className="h-3.5 w-11/12 bg-white/5" />
      <Skeleton className="h-1.5 w-full bg-white/5" />
      <div className="flex gap-1.5">
        <Skeleton className="h-4 w-12 bg-white/5" />
        <Skeleton className="h-4 w-12 bg-white/5" />
        <Skeleton className="h-4 w-12 bg-white/5" />
      </div>
    </div>
  );
}

function NewsItem({ item }: { item: NewsImpactResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`px-3 py-2.5 border-b border-white/5 transition-colors hover:bg-white/[0.02] ${
        item.riskLevel === "extreme"
          ? "border-l-2 border-l-red-500/60"
          : item.riskLevel === "high"
          ? "border-l-2 border-l-orange-500/50"
          : ""
      }`}
    >
      {/* Meta row */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${riskBadgeClass(
            item.riskLevel,
          )}`}
        >
          {item.riskLevel === "extreme" || item.riskLevel === "high" ? (
            <AlertTriangle className="w-2.5 h-2.5" />
          ) : null}
          {item.riskLevel}
        </span>
        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-white/5 text-slate-400 border-white/10 inline-flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {item.expectedDuration}
        </span>
        <span
          className={`text-[10px] uppercase tracking-wider ${categoryColor(
            item.category,
          )}`}
        >
          {item.category}
        </span>
        <span className="text-[10px] text-slate-500 ml-auto tt-mono">
          {relativeTime(item.publishedAt)}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-slate-100 leading-snug mb-1.5">
        {item.title}
      </h4>

      {/* Impact score bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-500 mb-1">
          <span className="inline-flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            Impact Score
          </span>
          <span className="tt-mono text-slate-300 font-semibold">
            {item.impactScore}
            <span className="text-slate-600">/100</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(2, Math.min(100, item.impactScore))}%`,
              backgroundColor: impactBarColor(item.impactScore),
            }}
          />
        </div>
      </div>

      {/* Affected symbols + confidence */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {item.affectedSymbols.slice(0, 6).map((s) => (
            <span
              key={s}
              className="tt-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10"
            >
              {s}
            </span>
          ))}
          {item.affectedSymbols.length > 6 && (
            <span className="text-[10px] text-slate-500 tt-mono">
              +{item.affectedSymbols.length - 6}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] uppercase tracking-wider text-slate-500">
            Conf
          </span>
          <span className="tt-mono text-[10px] text-slate-300 font-semibold">
            {item.confidence}%
          </span>
        </div>
      </div>

      {/* Reasoning (expandable) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        <span className="uppercase tracking-wider">Reasoning</span>
      </button>
      {expanded && (
        <p className="text-xs text-slate-400 leading-relaxed mt-1 pl-4">
          {item.reasoning}
        </p>
      )}
    </div>
  );
}

export function NewsImpactPanel() {
  const [data, setData] = useState<NewsImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/news-impact", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as NewsImpactResponse;
      setData(json);
    } catch {
      setError("Failed to load news impact analysis.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  const items = data?.items ?? [];
  const highImpact = data?.highImpactCount ?? 0;
  const riskSymbols = data?.topRiskSymbols ?? [];

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Newspaper className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold truncate">News Impact Engine</span>
          {highImpact > 0 && (
            <span className="text-[10px] uppercase tracking-wider text-red-300 bg-red-500/15 border border-red-500/30 rounded px-1.5 py-0.5 inline-flex items-center gap-1 shrink-0">
              <AlertTriangle className="w-2.5 h-2.5" />
              {highImpact} high
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fetchData()}
          disabled={refreshing}
          className="h-7 w-7 p-0 shrink-0"
          title="Refresh"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Top risk symbols row */}
      {riskSymbols.length > 0 && (
        <div className="px-3 py-2 border-b border-white/5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Top Risk Symbols
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {riskSymbols.map((r) => (
              <span
                key={r.symbol}
                className={`tt-mono text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${riskSymbolColor(
                  r.risk,
                )}`}
                title={`${r.symbol} risk score ${r.risk}`}
              >
                {r.symbol}
                <span className="font-semibold">{r.risk}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <NewsItemSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-xs text-slate-400 mb-2">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchData()}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No news impact analysis available.
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <NewsItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NewsImpactPanel;
