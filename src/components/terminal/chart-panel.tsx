"use client";

import { useState, useEffect } from "react";
import { CandleChart } from "@/components/charts/candle-chart";
import type { Quote, PairAnalysis, Candle } from "@/lib/types";
import { formatPrice, formatChange, formatNumber } from "@/lib/format";
import { ema, bollinger } from "@/lib/indicators/client-indicators";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ChartPanelProps {
  symbol: string;
  quote: Quote | null;
  analysis: PairAnalysis | undefined;
  name: string;
  category: string;
}

const TIMEFRAMES = ["m5", "m15", "h1", "h4", "d1"] as const;
type TF = (typeof TIMEFRAMES)[number];

export function ChartPanel({ symbol, quote, analysis, name, category }: ChartPanelProps) {
  const [tf, setTf] = useState<TF>("h1");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/market/candles?symbol=${symbol}&tf=${tf}&count=200`);
        const data = await res.json();
        if (cancelled) return;
        setCandles(data.candles || []);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, tf]);

  const closes = candles.map((c) => c.close);
  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const bb = bollinger(closes, 20, 2);

  const up = quote ? quote.changePct >= 0 : true;
  const trendIcon = analysis?.trend === "Bullish" ? TrendingUp : analysis?.trend === "Bearish" ? TrendingDown : Minus;

  return (
    <div className="tt-panel rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight">{symbol}</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">{category}</span>
            </div>
            <div className="text-[10px] text-slate-500">{name}</div>
          </div>
          {quote && (
            <div className="flex items-baseline gap-2 ml-2">
              <span className="text-xl font-bold tt-mono tabular-nums">
                {formatPrice(quote.last, quote.digits)}
              </span>
              <span className={`text-sm tt-mono ${up ? "tt-text-up" : "tt-text-down"}`}>
                {up ? "▲" : "▼"} {formatChange(quote.changePct)}
              </span>
            </div>
          )}
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-0.5 bg-black/30 rounded-md p-0.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`px-2 py-1 rounded text-[10px] font-bold tt-mono uppercase transition-colors ${
                tf === t ? "bg-white/15 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      {quote && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-white/5 border-b border-white/5">
          <Stat label="Bid" value={formatPrice(quote.bid, quote.digits)} />
          <Stat label="Ask" value={formatPrice(quote.ask, quote.digits)} />
          <Stat label="Spread" value={`${formatNumber(quote.spread / Math.pow(10, quote.digits - (quote.digits === 3 ? 1 : 0)), 1)} pips`} />
          <Stat label="High" value={formatPrice(quote.high, quote.digits)} />
          <Stat label="Low" value={formatPrice(quote.low, quote.digits)} />
          {analysis && (
            <Stat
              label="Trend"
              value={analysis.trend}
              valueClass={
                analysis.trend === "Bullish" ? "tt-text-up" : analysis.trend === "Bearish" ? "tt-text-down" : "text-slate-300"
              }
              icon={trendIcon}
            />
          )}
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0 p-2">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            Loading {symbol} {tf}…
          </div>
        ) : (
          <CandleChart
            candles={candles}
            digits={quote?.digits || 5}
            height={380}
            ema20={ema20Arr}
            ema50={ema50Arr}
            bbUpper={bb.upper}
            bbLower={bb.lower}
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass = "text-slate-200",
  icon: Icon,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon?: any;
}) {
  return (
    <div className="bg-[#0b0f15] px-3 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xs tt-mono flex items-center gap-1 ${valueClass}`}>
        {Icon && <Icon className="w-3 h-3" />}
        {value}
      </div>
    </div>
  );
}
