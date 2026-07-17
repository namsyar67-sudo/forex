"use client";

import { useState, useEffect, useCallback } from "react";
import { Newspaper, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import type { NewsItem } from "@/lib/types";
import { impactColor, relativeTime, categoryColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const REFRESH_INTERVAL = 60_000; // 60 seconds

/**
 * Market News feed panel.
 * - Fetches from /api/news
 * - Auto-refreshes every 60s
 * - Clicking a news item with symbols toggles a visual filter highlight
 */
export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchNews = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { news: NewsItem[]; time?: number };
      setItems(data.news ?? []);
      setLastUpdated(Date.now());
    } catch {
      setError("Failed to load news feed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const id = setInterval(() => fetchNews(true), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNews]);

  const handleItemClick = (item: NewsItem) => {
    if (item.symbols.length === 0) return;
    const first = item.symbols[0];
    setActiveSymbol((prev) => (prev === first ? null : first));
  };

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Newspaper className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">Market News</span>
          {lastUpdated && (
            <span className="text-[10px] text-slate-500 truncate">
              · updated {relativeTime(new Date(lastUpdated).toISOString())}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fetchNews()}
          disabled={refreshing}
          className="h-7 text-xs gap-1.5 shrink-0"
        >
          {refreshing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Refresh
        </Button>
      </div>

      {/* Active filter chip */}
      {activeSymbol && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/[0.06] border-b border-white/5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Filter</span>
          <span className="tt-mono text-[11px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
            {activeSymbol}
          </span>
          <button
            type="button"
            onClick={() => setActiveSymbol(null)}
            className="text-[10px] text-slate-500 hover:text-slate-300 ml-auto transition-colors"
          >
            clear ✕
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading ? (
          <div className="p-3 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-12 bg-white/5" />
                  <Skeleton className="h-3 w-14 bg-white/5" />
                  <Skeleton className="h-2 w-10 bg-white/5 ml-auto" />
                </div>
                <Skeleton className="h-3.5 w-11/12 bg-white/5" />
                <Skeleton className="h-2.5 w-full bg-white/5" />
                <Skeleton className="h-2.5 w-2/3 bg-white/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-xs text-slate-400 mb-2">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchNews()}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No news available.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => {
              const isActive = !!activeSymbol && item.symbols.includes(activeSymbol);
              const dimmed = !!activeSymbol && !isActive;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left p-3 transition-colors border-l-2 ${
                      isActive
                        ? "bg-emerald-500/[0.07] border-emerald-400"
                        : dimmed
                        ? "opacity-50 border-transparent hover:opacity-90"
                        : "border-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Meta row */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className={`inline-block text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${impactColor(
                          item.impact
                        )}`}
                      >
                        {item.impact}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider ${categoryColor(
                          item.category
                        )}`}
                      >
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-auto tt-mono">
                        {relativeTime(item.publishedAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-semibold text-slate-100 leading-snug mb-1">
                      {item.title}
                    </h4>

                    {/* Summary */}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {item.summary}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-slate-500">{item.source}</span>
                      {item.symbols.map((s) => (
                        <span
                          key={s}
                          className={`tt-mono text-[10px] px-1.5 py-0.5 rounded border ${
                            activeSymbol === s
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-white/5 text-slate-400 border-white/10"
                          }`}
                        >
                          {s}
                        </span>
                      ))}
                      {item.url && (
                        <ExternalLink className="w-3 h-3 text-slate-500 ml-auto" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default NewsFeed;
