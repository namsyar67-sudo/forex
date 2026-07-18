"use client";

import { useState, useEffect } from "react";
import { Brain, Newspaper, TrendingUp, Shield, ExternalLink, Loader2, RefreshCw, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AIDecision {
  symbol: string;
  decision: "BUY" | "SELL" | "WAIT" | "HOLD";
  confidence: number;
  direction: "long" | "short" | "neutral";
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  reasoning: string;
  newsAnalysis: string;
  marketAnalysis: string;
  liquidityAnalysis: string;
  chartAnalysis: string;
  keyFactors: string[];
  riskWarnings: string[];
  newsSourcesRead: { title: string; source: string; url: string }[];
  timestamp: number;
}

interface Props {
  symbol: string;
}

export function AIDecisionPanel({ symbol }: Props) {
  const [decision, setDecision] = useState<AIDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDecision = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-decision/${symbol}`, { signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setDecision(data.decision);
    } catch (e: any) {
      setError(e.message || "Failed to get AI decision");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDecision(null);
    fetchDecision();
  }, [symbol]);

  const decisionColor =
    decision?.decision === "BUY" ? "tt-text-up" :
    decision?.decision === "SELL" ? "tt-text-down" :
    decision?.decision === "WAIT" ? "text-amber-400" : "text-slate-400";

  const decisionBg =
    decision?.decision === "BUY" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
    decision?.decision === "SELL" ? "bg-red-500/15 border-red-500/30 text-red-400" :
    decision?.decision === "WAIT" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
    "bg-slate-500/15 border-slate-500/30 text-slate-400";

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="w-4 h-4 text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 tt-pulse-dot" />
          </div>
          <span className="text-sm font-semibold">AI Decision Engine</span>
          <span className="text-xs text-slate-500">· {symbol}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchDecision} disabled={loading} className="h-7 text-xs gap-1">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto tt-scroll">
        {loading && !decision && (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              AI is searching the web for real news and analyzing the market...
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && (
          <div className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-xs text-red-400">{error}</p>
            <Button size="sm" variant="ghost" onClick={fetchDecision} className="mt-2 h-7 text-xs">
              Retry
            </Button>
          </div>
        )}

        {decision && (
          <div className="p-3 space-y-3">
            {/* Decision Card */}
            <div className={`rounded-lg border p-3 ${decisionBg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  <span className="text-lg font-bold">{decision.decision}</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tt-mono">{decision.confidence}%</div>
                  <div className="text-[9px] uppercase opacity-70">Confidence</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="opacity-70">Direction: </span>
                  <span className="font-semibold uppercase">{decision.direction}</span>
                </div>
                <div>
                  <span className="opacity-70">Risk Reward: </span>
                  <span className="font-semibold tt-mono">1:{decision.riskReward}</span>
                </div>
              </div>
            </div>

            {/* Trade Setup */}
            {decision.decision !== "WAIT" && decision.decision !== "HOLD" && (
              <div className="rounded-lg bg-black/20 border border-white/5 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Trade Setup</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[9px] text-slate-500">Entry</div>
                    <div className="tt-mono text-slate-200">{decision.entryPrice.toFixed(5)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">Stop Loss</div>
                    <div className="tt-mono tt-text-down">{decision.stopLoss.toFixed(5)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">RR</div>
                    <div className="tt-mono text-slate-200">1:{decision.riskReward}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">TP1</div>
                    <div className="tt-mono tt-text-up">{decision.takeProfit1.toFixed(5)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">TP2</div>
                    <div className="tt-mono tt-text-up">{decision.takeProfit2.toFixed(5)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">TP3</div>
                    <div className="tt-mono tt-text-up">{decision.takeProfit3.toFixed(5)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Reasoning */}
            <div className="rounded-lg bg-black/20 border border-white/5 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Brain className="w-3 h-3 text-emerald-400" /> AI Reasoning
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{decision.reasoning}</p>
            </div>

            {/* Analysis Sections */}
            {decision.newsAnalysis && (
              <AnalysisSection title="News Analysis" icon={Newspaper} text={decision.newsAnalysis} color="text-sky-400" />
            )}
            {decision.marketAnalysis && (
              <AnalysisSection title="Market Analysis" icon={TrendingUp} text={decision.marketAnalysis} color="text-emerald-400" />
            )}
            {decision.liquidityAnalysis && (
              <AnalysisSection title="Liquidity Analysis" icon={Shield} text={decision.liquidityAnalysis} color="text-amber-400" />
            )}
            {decision.chartAnalysis && (
              <AnalysisSection title="Chart Analysis" icon={TrendingUp} text={decision.chartAnalysis} color="text-violet-400" />
            )}

            {/* Key Factors */}
            {decision.keyFactors.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Key Factors</div>
                <div className="flex flex-wrap gap-1">
                  {decision.keyFactors.map((f, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Warnings */}
            {decision.riskWarnings.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> Risk Warnings
                </div>
                <ul className="space-y-1">
                  {decision.riskWarnings.map((w, i) => (
                    <li key={i} className="text-[11px] text-amber-300/80 flex gap-1.5">
                      <span className="text-amber-400">!</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* News Sources Read */}
            {decision.newsSourcesRead.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                  <Newspaper className="w-3 h-3 text-sky-400" />
                  News Sources Read by AI ({decision.newsSourcesRead.length})
                </div>
                <div className="space-y-1">
                  {decision.newsSourcesRead.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-sky-400 transition-colors group"
                    >
                      <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-100" />
                      <span className="truncate flex-1">{s.title}</span>
                      <span className="text-slate-600 shrink-0">{s.source}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisSection({ title, icon: Icon, text, color }: { title: string; icon: any; text: string; color: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg bg-black/20 border border-white/5 p-2.5">
      <div className={`text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" /> {title}
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}
