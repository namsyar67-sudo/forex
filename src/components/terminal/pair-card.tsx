"use client";

import type { Quote, PairAnalysis } from "@/lib/types";
import { formatPrice, formatChange, signalClass, signalLabel, categoryColor } from "@/lib/format";

interface PairCardProps {
  quote: Quote;
  analysis?: PairAnalysis;
  name: string;
  category: string;
  selected: boolean;
  onClick: () => void;
}

export function PairCard({ quote, analysis, name, category, selected, onClick }: PairCardProps) {
  const up = quote.changePct >= 0;
  const signal = analysis?.signal;

  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-lg border p-2.5 transition-all duration-150 group w-full overflow-hidden ${
        selected
          ? "tt-glass-strong border-white/20 ring-1 ring-emerald-500/30"
          : "tt-panel border-white/5 hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      {/* Row 1: Symbol + Category badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold tracking-tight">{quote.symbol}</span>
        <span className={`text-[8px] uppercase tracking-wider ${categoryColor(category)}`}>
          {category}
        </span>
      </div>

      {/* Row 2: Price */}
      <div className="text-base font-semibold tt-mono tabular-nums truncate">
        {formatPrice(quote.last, quote.digits)}
      </div>

      {/* Row 3: Change + Signal */}
      <div className="flex items-center justify-between mt-0.5">
        <span className={`text-[11px] tt-mono ${up ? "tt-text-up" : "tt-text-down"}`}>
          {up ? "▲" : "▼"} {formatChange(quote.changePct)}
        </span>
        {signal && (
          <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${signalClass(signal)}`}>
            {signalLabel(signal)}
          </span>
        )}
      </div>

      {/* Row 4: Trend + Conf (if analysis) */}
      {analysis && (
        <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[9px]">
          <span className="text-slate-500">
            <span className={
              analysis.trend === "Bullish" ? "tt-text-up" :
              analysis.trend === "Bearish" ? "tt-text-down" : "text-slate-400"
            }>{analysis.trend}</span>
          </span>
          <span className="text-slate-500">
            RSI <span className="text-slate-300 tt-mono">{analysis.rsi}</span>
          </span>
        </div>
      )}
    </button>
  );
}
