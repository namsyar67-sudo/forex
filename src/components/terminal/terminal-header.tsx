"use client";

import { useEffect, useState } from "react";
import { Activity, Radio, Clock, Bell, Settings, Zap } from "lucide-react";
import type { SessionInfo } from "@/lib/types";

interface TerminalHeaderProps {
  session: SessionInfo;
  connected: boolean;
  unreadAlerts: number;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  activeView: string;
  onViewChange: (v: string) => void;
}

const VIEWS = [
  { id: "terminal", label: "Terminal" },
  { id: "analyst", label: "AI Analyst" },
  { id: "signals", label: "Signals" },
  { id: "monitor", label: "Monitor" },
  { id: "analysis", label: "Analysis" },
  { id: "smartmoney", label: "Smart Money" },
  { id: "mft", label: "MTF" },
  { id: "positions", label: "Positions" },
  { id: "journal", label: "Journal" },
  { id: "news", label: "News & Calendar" },
  { id: "market", label: "Market Depth" },
];

export function TerminalHeader({
  session,
  connected,
  unreadAlerts,
  onOpenAlerts,
  onOpenSettings,
  activeView,
  onViewChange,
}: TerminalHeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const utcTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });

  return (
    <header className="sticky top-0 z-40 tt-glass-strong border-b border-white/10">
      <div className="flex items-center gap-4 px-4 h-14">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 tt-pulse-dot ring-2 ring-[#07090d]" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold tracking-tight leading-none">AI Trading Terminal</div>
            <div className="text-[10px] text-slate-500 leading-none mt-0.5 tt-mono">v1.0 · QUANT ENGINE</div>
          </div>
        </div>

        {/* View tabs */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeView === v.id
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Session indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/5">
          <Radio className="w-3.5 h-3.5 text-amber-400" />
          <div className="text-xs">
            <span className="text-slate-400">Session: </span>
            <span className="font-medium text-slate-200">{session.name}</span>
          </div>
          <span className="text-[10px] text-slate-500 tt-mono">×{session.vol.toFixed(2)}</span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-emerald-400 tt-live-ring" : "bg-amber-400 tt-pulse-dot"
            }`}
          />
          <span className="text-[11px] font-medium text-slate-300 hidden sm:inline">
            {connected ? "LIVE" : "SYNC"}
          </span>
        </div>

        {/* UTC clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs tt-mono text-slate-300">{utcTime}</span>
          <span className="text-[9px] text-slate-600">UTC</span>
        </div>

        {/* Alerts */}
        <button
          onClick={onOpenAlerts}
          className="relative p-1.5 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Alerts"
        >
          <Bell className="w-4 h-4 text-slate-300" />
          {unreadAlerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
              {unreadAlerts > 99 ? "99+" : unreadAlerts}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      {/* Mobile view tabs */}
      <nav className="flex md:hidden items-center gap-1 px-4 pb-2 overflow-x-auto tt-scroll">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              activeView === v.id ? "bg-white/10 text-white" : "text-slate-400"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
