"use client";

import { useState, useEffect, useRef } from "react";
import { Brain, Newspaper, TrendingUp, Shield, ExternalLink, Loader2, RefreshCw, AlertTriangle, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  timeframe?: string;
  reasoning: string;
  newsAnalysis: string;
  marketAnalysis: string;
  liquidityAnalysis: string;
  chartAnalysis: string;
  keyFactors: string[];
  riskWarnings: string[];
  newsSourcesRead: { title: string; source: string; url: string }[];
  marketStatus?: "open" | "closed" | "weekend" | "holiday";
  marketStatusReason?: string;
  timestamp: number;
}

interface Props {
  symbol: string;
}

export function AIDecisionPanel({ symbol }: Props) {
  const [decision, setDecision] = useState<AIDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(0);

  const fetchDecision = async () => {
    const id = ++fetchRef.current;
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55000);
      const res = await fetch(`/api/ai-decision/${symbol}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response (may have timed out). Try again.");
      }

      const data = await res.json();
      if (id !== fetchRef.current) return; // stale response
      if (!data || !data.decision) {
        throw new Error(data?.error || "No decision returned by AI");
      }
      setDecision(data.decision);
    } catch (e: any) {
      if (id !== fetchRef.current) return;
      setError(e.name === "AbortError" ? "Request timed out (55s). AI may be processing — try again." : (e.message || "Failed to get AI decision"));
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    setDecision(null);
    setError(null);
    fetchDecision();
  }, [symbol]);

  const decisionBg =
    decision?.decision === "BUY" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
    decision?.decision === "SELL" ? "bg-red-500/15 border-red-500/30 text-red-400" :
    decision?.decision === "WAIT" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
    "bg-slate-500/15 border-slate-500/30 text-slate-400";

  const isMarketClosed = decision?.marketStatus && decision.marketStatus !== "open";

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

        {error && !loading && (
          <div className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-xs text-red-400 mb-2">{error}</p>
            <Button size="sm" variant="ghost" onClick={fetchDecision} className="h-7 text-xs">
              Retry
            </Button>
          </div>
        )}

        {decision && (
          <div className="p-3 space-y-3">
            {/* Market Status Banner (if closed) */}
            {isMarketClosed && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    Market {decision.marketStatus}
                  </div>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">{decision.marketStatusReason}</p>
                </div>
              </div>
            )}

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
              {decision.timeframe && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-[9px] uppercase opacity-70 mb-0.5">Analysis Timeframe</div>
                  <div className="text-[11px] font-medium">{decision.timeframe}</div>
                </div>
              )}
            </div>

            {/* Trade Setup */}
            {!isMarketClosed && decision.decision !== "WAIT" && decision.decision !== "HOLD" && decision.entryPrice > 0 && (
              <div className="rounded-lg bg-black/20 border border-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Trade Setup</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white/5 rounded px-2 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Entry</div>
                    <div className="tt-mono text-slate-200 text-sm font-semibold break-all">{decision.entryPrice}</div>
                  </div>
                  <div className="bg-red-500/5 rounded px-2 py-1.5 border border-red-500/10">
                    <div className="text-[9px] text-slate-500 uppercase">Stop Loss</div>
                    <div className="tt-mono tt-text-down text-sm font-semibold break-all">{decision.stopLoss}</div>
                  </div>
                  <div className="bg-white/5 rounded px-2 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Risk Reward</div>
                    <div className="tt-mono text-slate-200 text-sm font-semibold">1:{decision.riskReward}</div>
                  </div>
                  <div className="bg-emerald-500/5 rounded px-2 py-1.5 border border-emerald-500/10">
                    <div className="text-[9px] text-slate-500 uppercase">TP1</div>
                    <div className="tt-mono tt-text-up text-sm font-semibold break-all">{decision.takeProfit1}</div>
                  </div>
                  <div className="bg-emerald-500/5 rounded px-2 py-1.5 border border-emerald-500/10">
                    <div className="text-[9px] text-slate-500 uppercase">TP2</div>
                    <div className="tt-mono tt-text-up text-sm font-semibold break-all">{decision.takeProfit2}</div>
                  </div>
                  <div className="bg-emerald-500/5 rounded px-2 py-1.5 border border-emerald-500/10">
                    <div className="text-[9px] text-slate-500 uppercase">TP3</div>
                    <div className="tt-mono tt-text-up text-sm font-semibold break-all">{decision.takeProfit3}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Reasoning */}
            {decision.reasoning && (
              <div className="rounded-lg bg-black/20 border border-white/5 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                  <Brain className="w-3 h-3 text-emerald-400" /> AI Reasoning
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{decision.reasoning}</p>
              </div>
            )}

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
            {decision.keyFactors && decision.keyFactors.length > 0 && (
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
            {decision.riskWarnings && decision.riskWarnings.length > 0 && (
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
            {decision.newsSourcesRead && decision.newsSourcesRead.length > 0 && (
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
      <p className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}
