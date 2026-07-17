"use client";

import { useState, useEffect } from "react";
import type { PairAnalysis, AnalysisSummary, AIInterpretation } from "@/lib/types";
import { formatPrice, formatNumber, signalClass, signalLabel } from "@/lib/format";
import { Brain, Sparkles, Loader2, AlertTriangle, Target, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AnalysisPanelProps {
  symbol: string;
  analysis: PairAnalysis | undefined;
  summary: AnalysisSummary | null;
  digits: number;
  onOpenPosition: (data: { symbol: string; side: string; entryPrice: number; stopLoss: number; takeProfit: number; confidence: number; rationale: string }) => void;
}

export function AnalysisPanel({ symbol, analysis, summary, digits, onOpenPosition }: AnalysisPanelProps) {
  const [interpretation, setInterpretation] = useState<AIInterpretation | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    setInterpretation(null);
  }, [symbol]);

  const fetchAI = async () => {
    setLoadingAI(true);
    try {
      const res = await fetch(`/api/analysis/${symbol}/ai`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setInterpretation(data.interpretation);
    } catch {
      toast.error("AI interpretation failed");
    } finally {
      setLoadingAI(false);
    }
  };

  if (!analysis || !summary) {
    return (
      <div className="tt-panel rounded-xl h-full flex items-center justify-center text-sm text-slate-500">
        Select an instrument to view analysis.
      </div>
    );
  }

  const actionColor =
    summary.action === "buy"
      ? "tt-text-up"
      : summary.action === "sell"
      ? "tt-text-down"
      : "text-amber-400";

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold">AI Analysis</span>
          <span className="text-xs text-slate-500">· {symbol}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchAI}
          disabled={loadingAI}
          className="h-7 text-xs gap-1.5"
        >
          {loadingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {interpretation ? "Refresh AI" : "Interpret"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto tt-scroll">
        {/* Verdict card */}
        <div className="p-3 border-b border-white/5">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Signal</div>
              <div className={`text-xs font-bold px-1.5 py-0.5 rounded inline-block border ${signalClass(analysis.signal)}`}>
                {signalLabel(analysis.signal)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 tt-mono">Score {analysis.signalScore}/100</div>
            </div>
            <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Action</div>
              <div className={`text-sm font-bold uppercase ${actionColor}`}>{summary.action}</div>
              <div className="text-[10px] text-slate-500 mt-1 tt-mono">Confidence {summary.confidence}%</div>
            </div>
          </div>

          {interpretation ? (
            <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">AI Verdict</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{interpretation.verdict}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">{summary.summary}</p>
          )}
        </div>

        {/* Trade setup */}
        <div className="p-3 border-b border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Trade Setup
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Entry Zone</div>
              <div className="tt-mono text-slate-200">{summary.entryZone}</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Risk Score</div>
              <div className="tt-mono flex items-center gap-1">
                <span className={summary.riskScore > 60 ? "tt-text-down" : summary.riskScore > 35 ? "text-amber-400" : "tt-text-up"}>
                  {summary.riskScore}/100
                </span>
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Stop Loss</div>
              <div className="tt-mono tt-text-down">{formatPrice(summary.stopLoss, digits)}</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Take Profit</div>
              <div className="tt-mono tt-text-up">{formatPrice(summary.takeProfit, digits)}</div>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full mt-2.5 h-7 text-xs"
            onClick={() =>
              onOpenPosition({
                symbol,
                side: summary.action === "sell" ? "short" : "long",
                entryPrice: analysis.price,
                stopLoss: summary.stopLoss,
                takeProfit: summary.takeProfit,
                confidence: summary.confidence,
                rationale: summary.summary,
              })
            }
            disabled={summary.action === "hold" || summary.action === "wait"}
          >
            Open {summary.action === "sell" ? "Short" : "Long"} Position
          </Button>
        </div>

        {/* Indicators grid */}
        <div className="p-3 border-b border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Indicators
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Indicator label="RSI(14)" value={analysis.rsi.toString()} tone={analysis.rsi < 30 ? "up" : analysis.rsi > 70 ? "down" : "neutral"} />
            <Indicator label="ADX" value={analysis.adx.toString()} tone={analysis.adx > 25 ? "accent" : "neutral"} />
            <Indicator label="ATR %" value={analysis.atrPct.toString()} tone="neutral" />
            <Indicator label="Stoch %K" value={analysis.stochasticK.toString()} tone={analysis.stochasticK < 20 ? "up" : analysis.stochasticK > 80 ? "down" : "neutral"} />
            <Indicator label="MACD" value={analysis.macdHist > 0 ? "Bull" : "Bear"} tone={analysis.macdHist > 0 ? "up" : "down"} />
            <Indicator label="Volatility" value={analysis.volatility} tone={analysis.volatility === "Extreme" ? "down" : analysis.volatility === "High" ? "accent" : "neutral"} />
            <Indicator label="EMA20" value={formatPrice(analysis.ema20, digits)} tone="neutral" />
            <Indicator label="EMA50" value={formatPrice(analysis.ema50, digits)} tone="neutral" />
            <Indicator label="EMA200" value={formatPrice(analysis.ema200, digits)} tone="neutral" />
            <Indicator label="VWAP" value={formatPrice(analysis.vwap, digits)} tone="neutral" />
            <Indicator label="Support" value={formatPrice(analysis.support, digits)} tone="up" />
            <Indicator label="Resistance" value={formatPrice(analysis.resistance, digits)} tone="down" />
          </div>
        </div>

        {/* AI scenarios & drivers */}
        {interpretation && (
          <div className="p-3 border-b border-white/5 space-y-3">
            {interpretation.scenarios.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Scenarios</div>
                <div className="space-y-1.5">
                  {interpretation.scenarios.map((s, i) => (
                    <div key={i} className="rounded-md bg-black/20 p-2 border border-white/5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-slate-200">{s.name}</span>
                        <span className="text-[10px] tt-mono text-emerald-400">{s.probability}%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {interpretation.keyDrivers.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Key Drivers</div>
                <ul className="space-y-1">
                  {interpretation.keyDrivers.map((d, i) => (
                    <li key={i} className="text-[11px] text-slate-300 flex gap-1.5">
                      <span className="text-emerald-400">▸</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {interpretation.riskWarnings.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> Risk Warnings
                </div>
                <ul className="space-y-1">
                  {interpretation.riskWarnings.map((w, i) => (
                    <li key={i} className="text-[11px] text-amber-300/80 flex gap-1.5">
                      <span className="text-amber-400">!</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-md bg-white/5 p-2 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Recommendation
              </div>
              <p className="text-xs text-slate-200">{interpretation.recommendation}</p>
            </div>
          </div>
        )}

        {/* Rationale */}
        <div className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Quant Rationale</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">{summary.rationale}</p>
        </div>
      </div>
    </div>
  );
}

function Indicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral" | "accent";
}) {
  const color =
    tone === "up" ? "tt-text-up" : tone === "down" ? "tt-text-down" : tone === "accent" ? "text-amber-400" : "text-slate-200";
  return (
    <div className="rounded-md bg-black/20 px-2 py-1.5 border border-white/5">
      <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-[11px] tt-mono ${color}`}>{value}</div>
    </div>
  );
}
