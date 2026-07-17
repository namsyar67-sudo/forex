"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCheck,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";

type Priority = "low" | "medium" | "high" | "critical";
type EventType =
  | "NEW_SIGNAL"
  | "HIGH_IMPACT_NEWS"
  | "CLOSE_POSITION"
  | "MOVE_STOP_LOSS"
  | "TAKE_PROFIT_HIT"
  | "MARKET_STRUCTURE_CHANGED"
  | "VOLATILITY_ALERT"
  | "LIQUIDITY_ALERT"
  | "CONFIDENCE_CHANGED"
  | "BOS_DETECTED"
  | "CHOCH_DETECTED"
  | "OB_BROKEN"
  | "TREND_CHANGE"
  | "RISK_ELEVATED"
  | "NEWS_CHANGED"
  | "system";

interface TradeEvent {
  id: string;
  signalId: string | null;
  symbol: string;
  type: string;
  title: string;
  message: string;
  reason: string;
  confidence: number | null;
  priority: Priority;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  events: TradeEvent[];
  unreadCount: number;
  time: number;
}

const PRIORITY_BORDER: Record<Priority, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-500",
};

const PRIORITY_DOT: Record<Priority, string> = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-slate-400",
};

const EVENT_ICON: Record<string, string> = {
  NEW_SIGNAL: "🎯",
  HIGH_IMPACT_NEWS: "📰",
  CLOSE_POSITION: "🚫",
  MOVE_STOP_LOSS: "📢",
  TAKE_PROFIT_HIT: "✅",
  MARKET_STRUCTURE_CHANGED: "📊",
  VOLATILITY_ALERT: "⚡",
  LIQUIDITY_ALERT: "💧",
  CONFIDENCE_CHANGED: "📈",
  BOS_DETECTED: "🔗",
  CHOCH_DETECTED: "⚠️",
  OB_BROKEN: "🧱",
  TREND_CHANGE: "🔄",
  RISK_ELEVATED: "⚠️",
  NEWS_CHANGED: "📰",
  system: "🔔",
};

function iconFor(type: string): string {
  return EVENT_ICON[type] ?? "🔔";
}

export function NotificationFeed() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/notifications?limit=50", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as NotificationsResponse;
      setData(json);
    } catch {
      if (!silent) toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const id = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleMarkAllRead = useCallback(async () => {
    const unread = (data?.events ?? []).filter((e) => !e.read);
    if (unread.length === 0) {
      toast.info("No unread notifications");
      return;
    }
    setMarking(true);
    try {
      await Promise.all(
        unread.map((e) =>
          fetch(`/api/notifications/${e.id}`, { method: "PATCH" })
        )
      );
      toast.success(`Marked ${unread.length} as read`);
      await fetchData(true);
    } catch {
      toast.error("Failed to mark notifications as read");
    } finally {
      setMarking(false);
    }
  }, [data, fetchData]);

  const handleClearAll = useCallback(async () => {
    const events = data?.events ?? [];
    if (events.length === 0) {
      toast.info("Nothing to clear");
      return;
    }
    setClearing(true);
    try {
      await Promise.all(
        events.map((e) =>
          fetch(`/api/notifications/${e.id}`, { method: "DELETE" })
        )
      );
      toast.success("Notifications cleared");
      await fetchData(true);
    } catch {
      toast.error("Failed to clear notifications");
    } finally {
      setClearing(false);
    }
  }, [data, fetchData]);

  const events = data?.events ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            aria-label="Refresh"
            title="Refresh"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={marking || unreadCount === 0}
            className="inline-flex items-center gap-1 px-1.5 h-7 rounded-md text-[11px] font-medium bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 disabled:opacity-40 transition-colors"
            title="Mark all as read"
          >
            {marking ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCheck className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">Mark Read</span>
          </button>
          <button
            onClick={handleClearAll}
            disabled={clearing || events.length === 0}
            className="inline-flex items-center gap-1 px-1.5 h-7 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
            title="Clear all"
          >
            {clearing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading ? (
          <NotificationSkeleton />
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Bell className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
              No notifications. Signals and market events will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: TradeEvent }) {
  const priority = (event.priority as Priority) ?? "medium";
  const unread = !event.read;
  const icon = iconFor(event.type);

  return (
    <div
      className={`relative px-3 py-2.5 border-l-2 ${PRIORITY_BORDER[priority]} ${
        unread ? "bg-amber-500/[0.04]" : "bg-transparent"
      } hover:bg-white/[0.02] transition-colors`}
    >
      <div className="flex items-start gap-2">
        {/* Icon */}
        <span className="text-base leading-none mt-0.5 shrink-0 select-none">
          {icon}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-slate-100 truncate">
                {event.title}
              </span>
              {unread && (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[priority]}`}
                  title="Unread"
                />
              )}
            </div>
            <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500 shrink-0 mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              {relativeTime(event.createdAt)}
            </span>
          </div>

          {/* Message */}
          {event.message && (
            <p className="text-[11px] text-slate-300 leading-relaxed mt-1 whitespace-pre-wrap break-words">
              {event.message}
            </p>
          )}

          {/* Footer meta */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {event.symbol && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/5 text-slate-300 border border-white/10">
                {event.symbol}
              </span>
            )}
            {event.confidence != null && isFinite(event.confidence) && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium tt-mono bg-sky-500/10 text-sky-300 border border-sky-500/20">
                {event.confidence.toFixed(0)}% conf
              </span>
            )}
            {event.type && event.type !== "system" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider bg-white/5 text-slate-500 border border-white/5">
                {event.type.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="divide-y divide-white/[0.03]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-3 py-2.5 border-l-2 border-l-white/5">
          <div className="flex items-start gap-2">
            <Skeleton className="w-4 h-4 rounded-full bg-white/5 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-40 bg-white/5" />
                <Skeleton className="h-2.5 w-10 bg-white/5" />
              </div>
              <Skeleton className="h-3 w-full bg-white/5" />
              <Skeleton className="h-3 w-3/4 bg-white/5" />
              <div className="flex gap-1.5">
                <Skeleton className="h-4 w-12 bg-white/5" />
                <Skeleton className="h-4 w-14 bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotificationFeed;
