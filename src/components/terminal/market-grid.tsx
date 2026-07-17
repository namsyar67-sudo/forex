"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { Quote, PairAnalysis, InstrumentDef } from "@/lib/types";
import { PairCard } from "./pair-card";
import { Input } from "@/components/ui/input";

interface MarketGridProps {
  quotes: Record<string, Quote>;
  analysis: Record<string, PairAnalysis>;
  instruments: InstrumentDef[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}

const CATEGORIES = ["all", "forex", "metals", "crypto", "indices"] as const;

export function MarketGrid({
  quotes,
  analysis,
  instruments,
  selectedSymbol,
  onSelect,
}: MarketGridProps) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return instruments.filter((inst) => {
      if (category !== "all" && inst.category !== category) return false;
      if (search && !inst.symbol.toLowerCase().includes(search.toLowerCase()) && !inst.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [instruments, category, search]);

  const instrumentMap = useMemo(
    () => new Map(instruments.map((i) => [i.symbol, i])),
    [instruments]
  );

  return (
    <div className="tt-panel rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-white/5">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbols…"
            className="h-7 bg-transparent border-none focus-visible:ring-0 text-xs px-0 placeholder:text-slate-600"
          />
        </div>
        <div className="flex items-center gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider transition-colors ${
                category === c
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto tt-scroll p-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
          {filtered.map((inst) => {
            const q = quotes[inst.symbol];
            const a = analysis[inst.symbol];
            if (!q) {
              return (
                <div
                  key={inst.symbol}
                  className="rounded-lg border border-white/5 p-3 animate-pulse"
                >
                  <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-5 w-24 bg-white/5 rounded mb-1" />
                  <div className="h-3 w-20 bg-white/5 rounded" />
                </div>
              );
            }
            return (
              <PairCard
                key={inst.symbol}
                quote={q}
                analysis={a}
                name={inst.name}
                category={inst.category}
                selected={selectedSymbol === inst.symbol}
                onClick={() => onSelect(inst.symbol)}
              />
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="text-center text-xs text-slate-500 py-8">
            No instruments match your search.
          </div>
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-1.5 border-t border-white/5 text-[10px] text-slate-500 tt-mono flex items-center justify-between">
        <span>{filtered.length} instruments</span>
        <span>{Object.keys(quotes).length} live</span>
      </div>
    </div>
  );
}
