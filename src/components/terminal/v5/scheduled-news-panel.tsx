"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, impactColor } from "@/lib/format";

// ---------- Types (mirrors /api/news-intelligence/scheduled response) ----------

interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: "low" | "medium" | "high";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  eventTime: string;
  affectedSymbols: string[];
  minutesUntil: number;
  isUpcoming: boolean;
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

interface ScheduledResponse {
  events: CalendarEvent[];
  upcomingHigh: CalendarEvent[];
  scheduledAlerts: ScheduledAlert[];
  time?: number;
}

const REFRESH_MS = 30_000;

// ---------- Helpers ----------

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

function countdownLabel(minutesUntil: number): string {
  if (minutesUntil <= 0) return "due";
  if (minutesUntil < 60) return `${minutesUntil}m`;
  const h = Math.floor(minutesUntil / 60);
  const m = minutesUntil % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function countdownSeconds(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function urgencyClass(minutesUntil: number): {
  text: string;
  bg: string;
  pulse: boolean;
} {
  if (minutesUntil <= 5) {
    return {
      text: "text-red-300",
      bg: "bg-red-500/15 border-red-500/30",
      pulse: true,
    };
  }
  if (minutesUntil <= 15) {
    return {
      text: "text-amber-300",
      bg: "bg-amber-500/15 border-amber-500/30",
      pulse: false,
    };
  }
  return {
    text: "text-slate-300",
    bg: "bg-slate-500/15 border-slate-500/30",
    pulse: false,
  };
}

function actualColor(
  actual: string | null,
  forecast: string | null
): string {
  if (!actual) return "text-slate-500";
  const a = parseFloat(actual.replace(/[^0-9.\-]/g, ""));
  const f = forecast ? parseFloat(forecast.replace(/[^0-9.\-]/g, "")) : NaN;
  if (!isFinite(a) || !isFinite(f)) return "text-slate-300";
  if (a > f) return "text-emerald-400";
  if (a < f) return "text-red-400";
  return "text-slate-300";
}

// ---------- Component ----------

export function ScheduledNewsPanel() {
  const [data, setData] = useState<ScheduledResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tick state to re-render countdowns every second.
  const [, setTick] = useState(0);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    setRefreshing(true);
    try {
      const res = await fetch("/api/news-intelligence/scheduled", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ScheduledResponse;
      if (!json?.events) throw new Error("No events in response");
      setData(json);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load schedule";
      if (!silent) setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const id = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // 1-second tick so countdown timers update smoothly.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const upcoming = (data?.upcomingHigh ?? []).slice().sort((a, b) => {
    if (a.minutesUntil <= 0 && b.minutesUntil > 0) return 1;
    if (b.minutesUntil <= 0 && a.minutesUntil > 0) return -1;
    return a.minutesUntil - b.minutesUntil;
  });

  const allEvents = (data?.events ?? []).slice().sort((a, b) => {
    return new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime();
  });

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock
            className={`w-4 h-4 text-amber-300 shrink-0 ${
              refreshing ? "animate-pulse" : "tt-pulse-dot"
            }`}
          />
          <span className="text-sm font-semibold">Economic Calendar & Alerts</span>
          {data && (
            <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
              · {data.events.length} events
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fetchData(false)}
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
        ) : !data ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No scheduled events.
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Upcoming High Impact Section */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Upcoming High Impact
                </span>
                <span className="tt-mono text-[10px] text-slate-600 ml-auto">
                  {upcoming.length}
                </span>
              </div>

              {upcoming.length === 0 ? (
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center">
                  <Clock className="w-4 h-4 text-slate-600 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-500">
                    No upcoming high-impact events.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((ev) => (
                    <UpcomingEventRow key={ev.id} event={ev} />
                  ))}
                </div>
              )}
            </section>

            {/* All Events Table */}
            {allEvents.length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    All Events
                  </span>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-[60px_1fr_60px_56px_60px_60px_60px] gap-1 px-2 py-1.5 border-b border-white/5 text-[9px] uppercase tracking-wider text-slate-500">
                    <span>Time</span>
                    <span>Event</span>
                    <span>Ccy</span>
                    <span>Imp</span>
                    <span className="text-right">Fcst</span>
                    <span className="text-right">Prev</span>
                    <span className="text-right">Actual</span>
                  </div>
                  {/* Rows */}
                  <div className="divide-y divide-white/5">
                    {allEvents.map((ev) => {
                      const ccImpact = impactColor(ev.impact);
                      return (
                        <div
                          key={ev.id}
                          className="grid grid-cols-[60px_1fr_60px_56px_60px_60px_60px] gap-1 px-2 py-1.5 items-center text-[11px] hover:bg-white/[0.02]"
                        >
                          <span className="tt-mono text-slate-400">
                            {formatTime(ev.eventTime)}
                          </span>
                          <span className="text-slate-200 truncate" title={ev.title}>
                            {ev.title}
                          </span>
                          <span className="text-slate-400 truncate">
                            {flagFor(ev.currency)} {ev.currency}
                          </span>
                          <span>
                            <span
                              className={`inline-block text-[9px] uppercase tracking-wider px-1 py-0.5 rounded border ${ccImpact}`}
                            >
                              {ev.impact}
                            </span>
                          </span>
                          <span className="tt-mono text-right text-slate-300 truncate">
                            {ev.forecast ?? "—"}
                          </span>
                          <span className="tt-mono text-right text-slate-400 truncate">
                            {ev.previous ?? "—"}
                          </span>
                          <span
                            className={`tt-mono text-right truncate ${actualColor(
                              ev.actual,
                              ev.forecast
                            )}`}
                          >
                            {ev.actual ?? "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Scheduled alerts (silently shown if any pending) */}
            {data.scheduledAlerts.length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-sky-300" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Pending Alerts
                  </span>
                  <span className="tt-mono text-[10px] text-slate-600 ml-auto">
                    {data.scheduledAlerts.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.scheduledAlerts.slice(0, 12).map((a) => (
                    <span
                      key={a.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        a.fired
                          ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
                          : a.minutesBefore <= 5
                          ? "bg-red-500/15 text-red-300 border-red-500/30"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      }`}
                      title={`${a.eventTitle} · ${a.minutesBefore}m before`}
                    >
                      {a.fired ? "✓ " : ""}
                      {a.minutesBefore}m · {a.eventTitle.slice(0, 24)}
                      {a.eventTitle.length > 24 ? "…" : ""}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Upcoming event row ----------

function UpcomingEventRow({ event }: { event: CalendarEvent }) {
  const eventMs = new Date(event.eventTime).getTime();
  const remainingMs = eventMs - Date.now();
  const remainingMin = Math.max(0, Math.round(remainingMs / 60000));
  const u = urgencyClass(remainingMin);

  return (
    <div
      className={`rounded-lg border p-2.5 ${u.bg} ${
        remainingMin <= 5 ? "animate-pulse" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Countdown */}
        <div className="shrink-0 text-center min-w-[56px]">
          <div className={`tt-mono text-sm font-bold ${u.text}`}>
            {countdownLabel(remainingMin)}
          </div>
          {remainingMin < 60 && remainingMs > 0 && (
            <div className={`tt-mono text-[10px] ${u.text} opacity-80`}>
              {countdownSeconds(remainingMs)}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs font-semibold text-slate-100 leading-snug flex-1 min-w-0">
              {event.title}
            </h4>
            <span
              className={`inline-block text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${impactColor(
                event.impact
              )}`}
            >
              {event.impact}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px] text-slate-400">
            <span>
              {flagFor(event.currency)} {event.currency}
            </span>
            <span className="text-slate-600">·</span>
            <span className="tt-mono text-slate-400">
              {formatTime(event.eventTime)}
            </span>
            {(event.forecast || event.previous) && (
              <>
                <span className="text-slate-600">·</span>
                <span className="tt-mono">
                  F {event.forecast ?? "—"} / P {event.previous ?? "—"}
                </span>
              </>
            )}
          </div>

          {event.affectedSymbols.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {event.affectedSymbols.slice(0, 6).map((s) => (
                <span
                  key={s}
                  className="tt-mono text-[10px] px-1 py-0.5 rounded border bg-white/5 text-slate-400 border-white/10"
                >
                  {s}
                </span>
              ))}
              {event.affectedSymbols.length > 6 && (
                <span className="text-[10px] text-slate-500">
                  +{event.affectedSymbols.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Loading skeleton ----------

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div>
        <Skeleton className="h-3 w-32 mb-2 bg-white/5" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-white/5" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-3 w-24 mb-2 bg-white/5" />
        <Skeleton className="h-48 w-full bg-white/5" />
      </div>
    </div>
  );
}

export default ScheduledNewsPanel;
