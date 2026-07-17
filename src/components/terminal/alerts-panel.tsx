"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Info,
  AlertTriangle,
  AlertOctagon,
  Bell,
  CheckCheck,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";

export interface Alert {
  id: string;
  type: string;
  symbol: string | null;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface AlertsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_META: Record<
  Alert["severity"],
  { icon: typeof Info; color: string; ring: string; bg: string }
> = {
  info: {
    icon: Info,
    color: "text-sky-400",
    ring: "ring-sky-500/20",
    bg: "bg-sky-500/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    ring: "ring-amber-500/20",
    bg: "bg-amber-500/10",
  },
  critical: {
    icon: AlertOctagon,
    color: "text-red-400",
    ring: "ring-red-500/20",
    bg: "bg-red-500/10",
  },
};

export function AlertsPanel({ open, onOpenChange }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"mark" | "clear" | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts?limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { alerts: Alert[] };
      setAlerts(data.alerts ?? []);
    } catch {
      // silent fail to avoid toast spam on auto-refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchAlerts();
    const t = setInterval(fetchAlerts, 15000);
    return () => clearInterval(t);
  }, [open, fetchAlerts]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const markAllRead = async () => {
    const unread = alerts.filter((a) => !a.read);
    if (unread.length === 0) {
      toast("No unread alerts");
      return;
    }
    setBusy("mark");
    try {
      await Promise.all(
        unread.map((a) =>
          fetch(`/api/alerts/${a.id}`, { method: "PATCH" }).then((r) => {
            if (!r.ok) throw new Error();
          })
        )
      );
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
      toast.success(`Marked ${unread.length} alert${unread.length > 1 ? "s" : ""} as read`);
    } catch {
      toast.error("Failed to mark alerts as read");
    } finally {
      setBusy(null);
    }
  };

  const clearAll = async () => {
    if (alerts.length === 0) {
      toast("No alerts to clear");
      return;
    }
    setBusy("clear");
    try {
      await Promise.all(
        alerts.map((a) =>
          fetch(`/api/alerts/${a.id}`, { method: "DELETE" }).then((r) => {
            if (!r.ok) throw new Error();
          })
        )
      );
      setAlerts([]);
      toast.success("All alerts cleared");
    } catch {
      toast.error("Failed to clear alerts");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="tt-glass-strong w-full sm:max-w-md p-0 flex flex-col gap-0 border-white/10"
      >
        <SheetHeader className="p-4 border-b border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="w-4 h-4 text-amber-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-[9px] font-bold text-black flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <SheetTitle className="text-sm font-semibold">Alerts</SheetTitle>
              <span className="text-[10px] text-slate-500">
                · {alerts.length} total
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchAlerts}
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
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllRead}
                disabled={busy !== null}
                className="h-7 px-2 text-[11px] gap-1"
              >
                {busy === "mark" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCheck className="w-3 h-3" />
                )}
                Mark read
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearAll}
                disabled={busy !== null || alerts.length === 0}
                className="h-7 px-2 text-[11px] gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                {busy === "clear" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Clear
              </Button>
            </div>
          </div>
          <SheetDescription className="text-[10px] text-slate-500">
            Auto-refreshes every 15s while open.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto tt-scroll">
          {loading && alerts.length === 0 ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/5 bg-black/20 p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <Skeleton className="w-7 h-7 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-2.5 w-3/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 px-6">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-sm text-slate-300 mb-1">No alerts</p>
              <p className="text-[11px] text-slate-500">
                You&apos;ll see price signals, news events, and AI warnings here.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {alerts.map((alert) => {
                const meta = SEVERITY_META[alert.severity] ?? SEVERITY_META.info;
                const Icon = meta.icon;
                return (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-2.5 transition-colors ${
                      alert.read
                        ? "border-white/5 bg-black/20"
                        : "border-white/10 bg-amber-500/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${meta.bg} ring-1 ${meta.ring}`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {alert.title}
                          </span>
                          {!alert.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 tt-pulse-dot" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed mb-1.5">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="tt-mono">{relativeTime(alert.createdAt)}</span>
                          {alert.symbol && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 h-[14px] font-mono border-white/10 text-slate-400"
                            >
                              {alert.symbol}
                            </Badge>
                          )}
                          <span className="uppercase tracking-wider">
                            {alert.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
