"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import type { CalendarItem } from "@/lib/types";
import { impactColor, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const REFRESH_INTERVAL = 60_000; // 60 seconds

const CURRENCY_FLAG: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  CHF: "🇨🇭",
};

function flagFor(currency: string): string {
  return CURRENCY_FLAG[currency.toUpperCase()] ?? "🏳️";
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow =
    !isToday &&
    d.toDateString() ===
      new Date(today.getTime() + 24 * 60 * 60 * 1000).toDateString();
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    isToday,
    isTomorrow,
  };
}

/**
 * Economic Calendar panel.
 * - Fetches from /api/calendar
 * - Groups events by day with sticky day headers
 * - Auto-refreshes every 60s
 */
export function CalendarPanel() {
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchCalendar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar?days=2", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { events: CalendarItem[]; time?: number };
      setEvents(data.events ?? []);
      setLastUpdated(Date.now());
    } catch {
      setError("Failed to load economic calendar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
    const id = setInterval(() => fetchCalendar(true), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchCalendar]);

  // Group events by day, sorted ascending
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const ev of events) {
      const key = dayKey(ev.eventTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [events]);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold">Economic Calendar</span>
          {lastUpdated && (
            <span className="text-[10px] text-slate-500 truncate">
              · {events.length} events
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fetchCalendar()}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll min-h-0">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-2.5 w-1/3 bg-white/5" />
                <Skeleton className="h-3.5 w-3/4 bg-white/5" />
                <Skeleton className="h-2.5 w-1/2 bg-white/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-xs text-slate-400 mb-2">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchCalendar()}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No upcoming events scheduled.
          </div>
        ) : (
          grouped.map(([key, dayEvents]) => {
            const label = dayLabel(dayEvents[0].eventTime);
            return (
              <div key={key}>
                {/* Sticky day header */}
                <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[#0b0f15]/95 backdrop-blur-sm border-b border-white/5">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                    {label.weekday}
                  </span>
                  <span className="text-[10px] text-slate-500 tt-mono">{label.date}</span>
                  {label.isToday && (
                    <span className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      Today
                    </span>
                  )}
                  {label.isTomorrow && (
                    <span className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-sky-500/15 text-sky-400 border-sky-500/30">
                      Tomorrow
                    </span>
                  )}
                </div>

                {/* Events */}
                <ul>
                  {dayEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="px-3 py-2 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        {/* Time */}
                        <div className="w-11 shrink-0 pt-0.5">
                          <div className="text-[11px] tt-mono text-slate-300">
                            {formatTime(ev.eventTime)}
                          </div>
                        </div>

                        {/* Event */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="text-sm leading-none">
                              {flagFor(ev.currency)}
                            </span>
                            <span className="tt-mono text-[10px] text-slate-400">
                              {ev.currency}
                            </span>
                            <span
                              className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${impactColor(
                                ev.impact
                              )}`}
                            >
                              {ev.impact}
                            </span>
                          </div>
                          <div className="text-xs text-slate-200 leading-snug">
                            {ev.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {ev.country}
                          </div>

                          {/* Values */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <ValueCell
                              label="A"
                              value={ev.actual}
                              tone={ev.actual ? "up" : "dim"}
                            />
                            <ValueCell
                              label="F"
                              value={ev.forecast}
                              tone="neutral"
                            />
                            <ValueCell
                              label="P"
                              value={ev.previous}
                              tone="dim"
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ValueCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone: "up" | "down" | "neutral" | "dim";
}) {
  const color =
    tone === "up"
      ? "tt-text-up"
      : tone === "down"
      ? "tt-text-down"
      : tone === "dim"
      ? "text-slate-600"
      : "text-slate-300";
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[8px] uppercase tracking-wider text-slate-600">
        {label}
      </span>
      <span className={`text-[11px] tt-mono ${color}`}>{value ?? "—"}</span>
    </div>
  );
}

export default CalendarPanel;
