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
      className={`relative text-left rounded-lg border p-3 transition-all duration-150 group ${
        selected
          ? "tt-glass-strong border-white/20 ring-1 ring-emerald-500/30"
          : "tt-panel border-white/5 hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight">{quote.symbol}</span>
            <span className={`text-[9px] uppercase tracking-wider ${categoryColor(category)}`}>
              {category}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{name}</div>
        </div>
        {signal && (
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${signalClass(signal)}`}
          >
            {signalLabel(signal)}
          </span>
        )}
      </div>

      {/* Price — key changes on every tick to replay the flash animation */}
      <div className="flex items-baseline gap-2 mb-1">
        <span
          key={quote.last}
          className={`text-lg font-semibold tt-mono tabular-nums inline-block rounded px-0.5 -mx-0.5 ${
            up ? "tt-flash-up" : "tt-flash-down"
          }`}
        >
          {formatPrice(quote.last, quote.digits)}
        </span>
      </div>

      {/* Change */}
      <div className="flex items-center justify-between">
        <span className={`text-xs tt-mono ${up ? "tt-text-up" : "tt-text-down"}`}>
          {up ? "▲" : "▼"} {formatChange(quote.changePct)}
        </span>
        {analysis && (
          <span className="text-[10px] text-slate-500 tt-mono">
            RSI {analysis.rsi}
          </span>
        )}
      </div>

      {/* Mini indicator row */}
      {analysis && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
          <span className="text-slate-500">
            Trend:{" "}
            <span
              className={
                analysis.trend === "Bullish"
                  ? "tt-text-up"
                  : analysis.trend === "Bearish"
                  ? "tt-text-down"
                  : "text-slate-400"
              }
            >
              {analysis.trend}
            </span>
          </span>
          <span className="text-slate-500">
            Conf <span className="text-slate-300">{analysis.confidence}%</span>
          </span>
        </div>
      )}
    </button>
  );
}
