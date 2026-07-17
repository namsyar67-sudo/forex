"use client";

import type { Quote } from "@/lib/types";
import { formatPrice, formatChange } from "@/lib/format";

interface PriceTickerProps {
  quotes: Record<string, Quote>;
}

export function PriceTicker({ quotes }: PriceTickerProps) {
  const list = Object.values(quotes);
  if (list.length === 0) {
    return (
      <div className="h-8 border-b border-white/5 bg-[#0a0d12] flex items-center px-4">
        <span className="text-xs text-slate-600 tt-mono">Loading market data…</span>
      </div>
    );
  }

  // Duplicate the list for seamless marquee
  const doubled = [...list, ...list];

  return (
    <div className="h-8 border-b border-white/5 bg-[#0a0d12] overflow-hidden relative">
      <div className="absolute inset-0 flex items-center">
        <div className="flex tt-marquee gap-6 whitespace-nowrap">
          {doubled.map((q, i) => {
            const up = q.changePct >= 0;
            return (
              <div key={`${q.symbol}-${i}`} className="flex items-center gap-2 px-1">
                <span className="text-[11px] font-semibold text-slate-300">{q.symbol}</span>
                <span className="text-[11px] tt-mono text-slate-200">
                  {formatPrice(q.last, q.digits)}
                </span>
                <span
                  className={`text-[11px] tt-mono ${up ? "tt-text-up" : "tt-text-down"}`}
                >
                  {up ? "▲" : "▼"} {formatChange(q.changePct)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0d12] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0d12] to-transparent pointer-events-none" />
    </div>
  );
}
