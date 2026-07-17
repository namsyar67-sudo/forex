// Formatting utilities for the trading terminal

export function formatPrice(value: number, digits: number): string {
  if (!isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatChange(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompact(value: number): string {
  if (!isFinite(value)) return "—";
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toFixed(2);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatTimeWithSeconds(iso: string | number): string {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function signalClass(signal: string): string {
  switch (signal) {
    case "STRONG_BUY": return "tt-signal-strong-buy";
    case "BUY": return "tt-signal-buy";
    case "NEUTRAL": return "tt-signal-neutral";
    case "SELL": return "tt-signal-sell";
    case "STRONG_SELL": return "tt-signal-strong-sell";
    default: return "tt-signal-neutral";
  }
}

export function signalLabel(signal: string): string {
  return signal.replace(/_/g, " ");
}

export function trendColor(trend: string): string {
  if (trend === "Bullish") return "text-emerald-400";
  if (trend === "Bearish") return "text-red-400";
  return "text-slate-400";
}

export function categoryColor(category: string): string {
  switch (category) {
    case "forex": return "text-sky-300";
    case "crypto": return "text-amber-300";
    case "indices": return "text-violet-300";
    case "metals": return "text-yellow-300";
    case "commodities": return "text-orange-300";
    default: return "text-slate-300";
  }
}

export function impactColor(impact: string): string {
  switch (impact) {
    case "high": return "bg-red-500/15 text-red-400 border-red-500/30";
    case "medium": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    default: return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}
