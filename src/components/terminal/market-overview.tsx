"use client";

import { useMemo } from "react";
import { ArrowUp, ArrowDown, Activity, Gauge, Flame, Layers } from "lucide-react";
import type { Quote, PairAnalysis } from "@/lib/types";

interface MarketOverviewProps {
  quotes: Record<string, Quote>;
  analysis: Record<string, PairAnalysis>;
}

export function MarketOverview({ quotes, analysis }: MarketOverviewProps) {
  const stats = useMemo(() => {
    const list = Object.values(quotes);
    const up = list.filter((q) => q.changePct > 0).length;
    const down = list.filter((q) => q.changePct < 0).length;
    const flat = list.length - up - down;
    const avgChange = list.length
      ? list.reduce((a, q) => a + q.changePct, 0) / list.length
      : 0;
    const topGainer = [...list].sort((a, b) => b.changePct - a.changePct)[0];
    const topLoser = [...list].sort((a, b) => a.changePct - b.changePct)[0];

    const analysisList = Object.values(analysis);
    const buySignals = analysisList.filter((a) => a.signal === "BUY" || a.signal === "STRONG_BUY").length;
    const sellSignals = analysisList.filter((a) => a.signal === "SELL" || a.signal === "STRONG_SELL").length;
    const highVol = analysisList.filter((a) => a.volatility === "High" || a.volatility === "Extreme").length;
    const avgConfidence = analysisList.length
      ? Math.round(analysisList.reduce((a, x) => a + x.confidence, 0) / analysisList.length)
      : 0;

    return { up, down, flat, avgChange, topGainer, topLoser, buySignals, sellSignals, highVol, avgConfidence, total: list.length };
  }, [quotes, analysis]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {/* Market breadth */}
      <StatCard
        icon={<Layers className="w-3.5 h-3.5" />}
        label="Market Breadth"
        value={`${stats.up} / ${stats.down}`}
        sub={`${stats.flat} flat`}
        tone={stats.up >= stats.down ? "up" : "down"}
      />
      {/* Avg change */}
      <StatCard
        icon={stats.avgChange >= 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
        label="Avg Change"
        value={`${stats.avgChange >= 0 ? "+" : ""}${stats.avgChange.toFixed(3)}%`}
        sub="all instruments"
        tone={stats.avgChange >= 0 ? "up" : "down"}
      />
      {/* Top gainer */}
      {stats.topGainer && (
        <StatCard
          icon={<ArrowUp className="w-3.5 h-3.5" />}
          label="Top Gainer"
          value={stats.topGainer.symbol}
          sub={`+${stats.topGainer.changePct.toFixed(2)}%`}
          tone="up"
        />
      )}
      {/* Top loser */}
      {stats.topLoser && (
        <StatCard
          icon={<ArrowDown className="w-3.5 h-3.5" />}
          label="Top Loser"
          value={stats.topLoser.symbol}
          sub={`${stats.topLoser.changePct.toFixed(2)}%`}
          tone="down"
        />
      )}
      {/* Signals */}
      <StatCard
        icon={<Activity className="w-3.5 h-3.5" />}
        label="Signals"
        value={`${stats.buySignals}B / ${stats.sellSignals}S`}
        sub={`${stats.total - stats.buySignals - stats.sellSignals} neutral`}
        tone="accent"
      />
      {/* Volatility */}
      <StatCard
        icon={<Flame className="w-3.5 h-3.5" />}
        label="High Volatility"
        value={`${stats.highVol}`}
        sub={`avg conf ${stats.avgConfidence}%`}
        tone={stats.highVol > 5 ? "down" : "neutral"}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "up" | "down" | "accent" | "neutral";
}) {
  const toneColor =
    tone === "up" ? "tt-text-up" : tone === "down" ? "tt-text-down" : tone === "accent" ? "tt-text-accent" : "text-slate-300";
  const iconColor =
    tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : tone === "accent" ? "text-amber-400" : "text-slate-500";
  return (
    <div className="tt-panel rounded-lg px-3 py-2 flex items-center gap-2.5">
      <div className={`shrink-0 ${iconColor}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 leading-none mb-0.5">{label}</div>
        <div className={`text-sm font-semibold tt-mono leading-none truncate ${toneColor}`}>{value}</div>
        <div className="text-[10px] text-slate-500 leading-none mt-0.5 truncate">{sub}</div>
      </div>
    </div>
  );
}
