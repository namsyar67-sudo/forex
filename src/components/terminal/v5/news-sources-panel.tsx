"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Globe,
  Loader2,
  Newspaper,
  Radio,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ---------- Types ----------

interface NewsSource {
  id: string;
  name: string;
  category: "wire" | "financial" | "forex" | "crypto" | "general";
  reliability: number; // 0..1
  speed: number; // 0..1
  url: string;
  enabled: boolean;
  region: string;
}

interface SourcesResponse {
  sources: NewsSource[];
  totalCount: number;
  enabledCount: number;
  byCategory: {
    wire: number;
    financial: number;
    forex: number;
    crypto: number;
    general: number;
  };
}

// ---------- Static config ----------

const CATEGORY_META: Record<
  NewsSource["category"],
  { label: string; badge: string; icon: typeof Globe }
> = {
  wire: {
    label: "Wire Services",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: Radio,
  },
  financial: {
    label: "Financial",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    icon: Newspaper,
  },
  forex: {
    label: "Forex",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: Globe,
  },
  crypto: {
    label: "Crypto",
    badge: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    icon: Zap,
  },
  general: {
    label: "General",
    badge: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    icon: Globe,
  },
};

const CATEGORY_ORDER: NewsSource["category"][] = [
  "wire",
  "financial",
  "forex",
  "crypto",
  "general",
];

function reliabilityColor(r: number): string {
  if (r >= 0.9) return "bg-emerald-500";
  if (r >= 0.8) return "bg-amber-500";
  return "bg-slate-500";
}

function reliabilityText(r: number): string {
  if (r >= 0.9) return "text-emerald-400";
  if (r >= 0.8) return "text-amber-400";
  return "text-slate-400";
}

function speedColor(s: number): string {
  if (s >= 0.9) return "bg-sky-500";
  if (s >= 0.8) return "bg-cyan-500";
  return "bg-slate-500";
}

// ---------- Component ----------

export function NewsSourcesPanel() {
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news-intelligence/sources", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SourcesResponse;
      if (!json?.sources) throw new Error("No sources in response");
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load sources";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group sources by category (preserving config order)
  const grouped = (() => {
    if (!data) return [] as { category: NewsSource["category"]; items: NewsSource[] }[];
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: data.sources.filter((s) => s.category === category),
    })).filter((g) => g.items.length > 0);
  })();

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-sky-300 shrink-0" />
          <span className="text-sm font-semibold">News Sources</span>
          {data && (
            <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
              · {data.enabledCount}/{data.totalCount} enabled
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchData}
          disabled={loading}
          className="h-7 text-xs gap-1.5 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Globe className="w-3 h-3" />
          )}
          Reload
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
              onClick={fetchData}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : !data ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No sources configured.
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_ORDER.map((cat) => {
                const meta = CATEGORY_META[cat];
                const count = data.byCategory[cat] ?? 0;
                const Icon = meta.icon;
                return (
                  <div
                    key={cat}
                    className="bg-white/[0.02] border border-white/5 rounded-lg p-2 text-center"
                  >
                    <Icon className="w-3 h-3 mx-auto text-slate-400 mb-1" />
                    <div className="tt-mono text-sm font-semibold text-slate-200">
                      {count}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid by category */}
            {grouped.map(({ category, items }) => {
              const meta = CATEGORY_META[category];
              const Icon = meta.icon;
              return (
                <div key={category}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      {meta.label}
                    </span>
                    <span className="tt-mono text-[10px] text-slate-600">
                      · {items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((source) => (
                      <SourceCard key={source.id} source={source} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Source card ----------

function SourceCard({ source }: { source: NewsSource }) {
  const reliabilityPct = Math.round(source.reliability * 100);
  const speedPct = Math.round(source.speed * 100);

  return (
    <div
      className={`rounded-lg border p-2.5 transition-colors ${
        source.enabled
          ? "border-white/10 bg-white/[0.03]"
          : "border-white/5 bg-white/[0.01] opacity-60"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`relative flex h-2 w-2 shrink-0 ${
            source.enabled ? "" : "opacity-40"
          }`}
        >
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              source.enabled ? "bg-emerald-500" : "bg-slate-600"
            }`}
          />
        </span>
        <span className="text-xs font-semibold text-slate-100 truncate flex-1">
          {source.name}
        </span>
        <span
          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
            CATEGORY_META[source.category].badge
          }`}
        >
          {source.category}
        </span>
      </div>

      {/* Bars */}
      <div className="space-y-1.5">
        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="uppercase tracking-wider text-slate-500">
              Reliability
            </span>
            <span className={`tt-mono ${reliabilityText(source.reliability)}`}>
              {reliabilityPct}%
            </span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${reliabilityColor(
                source.reliability
              )}`}
              style={{ width: `${reliabilityPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="uppercase tracking-wider text-slate-500">Speed</span>
            <span className="tt-mono text-slate-400">{speedPct}%</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${speedColor(source.speed)}`}
              style={{ width: `${speedPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-white/5 text-slate-400 border-white/10">
          {source.region}
        </span>
        {!source.enabled && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-slate-500/15 text-slate-400 border-slate-500/30">
            Disabled
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Loading skeleton ----------

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/5" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, gi) => (
        <div key={gi}>
          <Skeleton className="h-3 w-24 mb-2 bg-white/5" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full bg-white/5" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default NewsSourcesPanel;
