"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Action = "buy" | "sell" | "hold" | "wait";

interface ReanalysisComparison {
  trendBefore: string;
  trendAfter: string;
  confidenceBefore: number;
  confidenceAfter: number;
  signalScoreBefore: number;
  signalScoreAfter: number;
  riskBefore: number;
  riskAfter: number;
  rsiBefore: number;
  rsiAfter: number;
  sentimentBefore: string;
  sentimentAfter: string;
  liquidityBefore: string;
  liquidityAfter: string;
  orderBlocksBefore: number;
  orderBlocksAfter: number;
  fvgsBefore: number;
  fvgsAfter: number;
  bosBefore: number;
  bosAfter: number;
  recommendationBefore: Action;
  recommendationAfter: Action;
  timeDelta: number;
}

interface CurrentSMC {
  bias: string;
  biasStrength: string;
  marketStructure: string;
  activeOrderBlocks: number;
  activeFVGs: number;
}

interface CurrentMTF {
  decision: string;
  confidence: number;
  alignment: string;
  trendBias: string;
}

interface CurrentSummary {
  symbol: string;
  action: Action;
  confidence: number;
  entryZone: string;
  stopLoss: number;
  takeProfit: number;
  riskScore: number;
  trend: string;
  volatility: string;
  session: string;
  summary: string;
  rationale: string;
  indicators: Record<string, number>;
}

interface ReanalysisResponse {
  symbol: string;
  current: {
    analysis: unknown;
    summary: CurrentSummary;
    smc: CurrentSMC | null;
    mtf: CurrentMTF;
  };
  comparison: ReanalysisComparison | null;
  timestamp?: number;
}

const ACTION_BADGE: Record<Action, string> = {
  buy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  sell: "bg-red-500/10 text-red-400 border-red-500/30",
  hold: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  wait: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const ACTION_TEXT: Record<Action, string> = {
  buy: "tt-text-up",
  sell: "tt-text-down",
  hold: "tt-text-dim",
  wait: "tt-text-accent",
};

// Rank actions from most bearish (0) to most bullish (3) for delta direction.
const ACTION_RANK: Record<Action, number> = {
  sell: 0,
  wait: 1,
  hold: 2,
  buy: 3,
};

function actionTrend(before: Action, after: Action): "up" | "down" | "flat" {
  const b = ACTION_RANK[before] ?? 1;
  const a = ACTION_RANK[after] ?? 1;
  if (a > b) return "up";
  if (a < b) return "down";
  return "flat";
}

const TREND_RANK: Record<string, number> = {
  Bullish: 2,
  Sideways: 1,
  Bearish: 0,
};

const SENTIMENT_CLASS: Record<string, string> = {
  bullish: "tt-text-up",
  bearish: "tt-text-down",
  neutral: "tt-text-dim",
};

const LIQUIDITY_CLASS: Record<string, string> = {
  Deep: "tt-text-up",
  Normal: "tt-text-dim",
  Thin: "tt-text-down",
};

interface ReanalyzeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
}

function trendTone(before: string, after: string): "up" | "down" | "flat" {
  const b = TREND_RANK[before] ?? 1;
  const a = TREND_RANK[after] ?? 1;
  if (a > b) return "up";
  if (a < b) return "down";
  return "flat";
}

function deltaTone(delta: number, positiveIsGood: boolean): "up" | "down" | "flat" {
  if (Math.abs(delta) < 1e-6) return "flat";
  const positive = delta > 0;
  const good = positiveIsGood ? positive : !positive;
  return good ? "up" : "down";
}

function deltaText(delta: number, suffix = ""): string {
  if (Math.abs(delta) < 1e-6) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(delta % 1 === 0 ? 0 : 1)}${suffix}`;
}

interface ComparisonRowProps {
  label: string;
  before: string;
  after: string;
  beforeClass?: string;
  afterClass?: string;
  delta?: { value: number; positiveIsGood: boolean; suffix?: string };
  trend?: "up" | "down" | "flat";
}

function ComparisonRow({
  label,
  before,
  after,
  beforeClass,
  afterClass,
  delta,
  trend,
}: ComparisonRowProps) {
  let deltaToneClass = "text-slate-500";
  let DeltaIcon: typeof TrendingUp | null = null;
  if (trend === "up") {
    deltaToneClass = "tt-text-up";
    DeltaIcon = TrendingUp;
  } else if (trend === "down") {
    deltaToneClass = "tt-text-down";
    DeltaIcon = TrendingDown;
  } else if (delta) {
    const t = deltaTone(delta.value, delta.positiveIsGood);
    if (t === "up") {
      deltaToneClass = "tt-text-up";
      DeltaIcon = TrendingUp;
    } else if (t === "down") {
      deltaToneClass = "tt-text-down";
      DeltaIcon = TrendingDown;
    }
  }

  return (
    <div className="grid grid-cols-[110px_1fr_auto_1fr] gap-2 items-center px-2.5 py-1.5 border-b border-white/[0.04] last:border-0 text-[11px]">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 truncate">
        {label}
      </span>
      <span className={`tt-mono text-right ${beforeClass ?? "text-slate-400"}`}>
        {before}
      </span>
      <ArrowRight className="w-3 h-3 text-slate-600 mx-auto" />
      <span className="flex items-center gap-1.5 justify-end">
        <span className={`tt-mono font-semibold text-right ${afterClass ?? "text-slate-200"}`}>
          {after}
        </span>
        {(delta || trend) && DeltaIcon && (
          <span
            className={`inline-flex items-center gap-0.5 text-[9px] tt-mono ${deltaToneClass}`}
            title="Change vs. previous snapshot"
          >
            <DeltaIcon className="w-2.5 h-2.5" />
            {delta ? deltaText(delta.value, delta.suffix) : ""}
          </span>
        )}
      </span>
    </div>
  );
}

export function ReanalyzeDialog({
  open,
  onOpenChange,
  symbol,
}: ReanalyzeDialogProps) {
  const [data, setData] = useState<ReanalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runReanalyze = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(
        `/api/reanalyze/${encodeURIComponent(symbol.toUpperCase())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as ReanalysisResponse;
      setData(json);
      toast.success(`ReAnalyze complete · ${symbol.toUpperCase()}`, {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        description: json.comparison
          ? "Before/after comparison ready."
          : "First analysis recorded.",
      });
    } catch {
      toast.error(`ReAnalyze failed for ${symbol.toUpperCase()}`);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (open) {
      runReanalyze();
    } else {
      // reset on close to avoid stale state on reopen
      setData(null);
      setLoading(false);
    }
  }, [open, runReanalyze]);

  const comparison = data?.comparison ?? null;
  const summary = data?.current?.summary ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tt-glass-strong border-white/10 max-h-[88vh] flex flex-col gap-0 p-0 sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-white/5 space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 tt-text-accent" />
            <DialogTitle className="text-sm font-semibold">
              ReAnalyze — {symbol.toUpperCase()}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-slate-500">
            Snapshots current market state and compares it to the previous
            snapshot for {symbol.toUpperCase()}.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto tt-scroll p-3 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="w-6 h-6 tt-text-accent animate-spin mb-3" />
              <p className="text-xs text-slate-400">
                Analyzing market structure…
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                Capturing SMC, MTF, indicators, and sentiment.
              </p>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-xs text-slate-400">No data available.</p>
            </div>
          ) : comparison === null ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 tt-text-up" />
                <span className="text-xs font-semibold text-emerald-300">
                  First analysis recorded
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Click <span className="text-slate-200 font-medium">ReAnalyze</span>{" "}
                again later to compare. Future runs will surface a
                before/after diff of trend, confidence, signal score, SMC
                structure, and recommendation.
              </p>
            </div>
          ) : (
            <>
              {/* Time delta */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>
                  Comparing snapshots ·{" "}
                  <span className="tt-mono text-slate-400">
                    {(comparison.timeDelta / 60000).toFixed(1)}m
                  </span>{" "}
                  apart
                </span>
                <span className="tt-mono">
                  rec #{data.timestamp ?? ""}
                </span>
              </div>

              {/* Comparison table */}
              <div className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
                <ComparisonRow
                  label="Trend"
                  before={comparison.trendBefore}
                  after={comparison.trendAfter}
                  beforeClass="text-slate-400"
                  afterClass={
                    comparison.trendAfter === "Bullish"
                      ? "tt-text-up"
                      : comparison.trendAfter === "Bearish"
                      ? "tt-text-down"
                      : "tt-text-dim"
                  }
                  trend={trendTone(comparison.trendBefore, comparison.trendAfter)}
                />
                <ComparisonRow
                  label="Confidence"
                  before={`${Math.round(comparison.confidenceBefore)}%`}
                  after={`${Math.round(comparison.confidenceAfter)}%`}
                  delta={{
                    value: comparison.confidenceAfter - comparison.confidenceBefore,
                    positiveIsGood: true,
                    suffix: "pp",
                  }}
                />
                <ComparisonRow
                  label="Signal Score"
                  before={`${Math.round(comparison.signalScoreBefore)}`}
                  after={`${Math.round(comparison.signalScoreAfter)}`}
                  delta={{
                    value: comparison.signalScoreAfter - comparison.signalScoreBefore,
                    positiveIsGood: true,
                  }}
                />
                <ComparisonRow
                  label="Risk"
                  before={`${Math.round(comparison.riskBefore)}`}
                  after={`${Math.round(comparison.riskAfter)}`}
                  afterClass={
                    comparison.riskAfter > 60
                      ? "tt-text-down"
                      : comparison.riskAfter > 35
                      ? "tt-text-accent"
                      : "tt-text-up"
                  }
                  delta={{
                    value: comparison.riskAfter - comparison.riskBefore,
                    positiveIsGood: false,
                  }}
                />
                <ComparisonRow
                  label="RSI"
                  before={comparison.rsiBefore.toFixed(1)}
                  after={comparison.rsiAfter.toFixed(1)}
                  delta={{
                    value: comparison.rsiAfter - comparison.rsiBefore,
                    positiveIsGood: true,
                  }}
                />
                <ComparisonRow
                  label="Sentiment"
                  before={comparison.sentimentBefore}
                  after={comparison.sentimentAfter}
                  beforeClass={SENTIMENT_CLASS[comparison.sentimentBefore] ?? "text-slate-400"}
                  afterClass={SENTIMENT_CLASS[comparison.sentimentAfter] ?? "text-slate-200"}
                />
                <ComparisonRow
                  label="Liquidity"
                  before={comparison.liquidityBefore}
                  after={comparison.liquidityAfter}
                  beforeClass={LIQUIDITY_CLASS[comparison.liquidityBefore] ?? "text-slate-400"}
                  afterClass={LIQUIDITY_CLASS[comparison.liquidityAfter] ?? "text-slate-200"}
                />
                <ComparisonRow
                  label="Order Blocks"
                  before={`${comparison.orderBlocksBefore}`}
                  after={`${comparison.orderBlocksAfter}`}
                  delta={{
                    value: comparison.orderBlocksAfter - comparison.orderBlocksBefore,
                    positiveIsGood: true,
                  }}
                />
                <ComparisonRow
                  label="FVGs"
                  before={`${comparison.fvgsBefore}`}
                  after={`${comparison.fvgsAfter}`}
                  delta={{
                    value: comparison.fvgsAfter - comparison.fvgsBefore,
                    positiveIsGood: true,
                  }}
                />
                <ComparisonRow
                  label="BOS Count"
                  before={`${comparison.bosBefore}`}
                  after={`${comparison.bosAfter}`}
                  delta={{
                    value: comparison.bosAfter - comparison.bosBefore,
                    positiveIsGood: true,
                  }}
                />
                <ComparisonRow
                  label="Recommendation"
                  before={comparison.recommendationBefore.toUpperCase()}
                  after={comparison.recommendationAfter.toUpperCase()}
                  beforeClass={
                    ACTION_TEXT[comparison.recommendationBefore as Action] ??
                    "text-slate-400"
                  }
                  afterClass={
                    ACTION_TEXT[comparison.recommendationAfter as Action] ??
                    "text-slate-200"
                  }
                  trend={actionTrend(
                    comparison.recommendationBefore as Action,
                    comparison.recommendationAfter as Action
                  )}
                />
              </div>

              {/* Current summary card */}
              {summary && (
                <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-3 h-3 tt-text-accent" />
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">
                      Current Summary
                    </span>
                    <span
                      className={`ml-auto inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                        ACTION_BADGE[summary.action] ?? ACTION_BADGE.hold
                      }`}
                    >
                      {summary.action.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-2">
                    {summary.summary}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        Confidence
                      </div>
                      <div className="tt-mono text-slate-200">
                        {Math.round(summary.confidence)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        Risk
                      </div>
                      <div
                        className={`tt-mono ${
                          summary.riskScore > 60
                            ? "tt-text-down"
                            : summary.riskScore > 35
                            ? "tt-text-accent"
                            : "tt-text-up"
                        }`}
                      >
                        {Math.round(summary.riskScore)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        Trend
                      </div>
                      <div
                        className={`tt-mono ${
                          summary.trend === "Bullish"
                            ? "tt-text-up"
                            : summary.trend === "Bearish"
                            ? "tt-text-down"
                            : "tt-text-dim"
                        }`}
                      >
                        {summary.trend}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        Entry
                      </div>
                      <div className="tt-mono text-slate-300 truncate">
                        {summary.entryZone}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        Stop
                      </div>
                      <div className="tt-mono tt-text-down truncate">
                        {summary.stopLoss}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        Target
                      </div>
                      <div className="tt-mono tt-text-up truncate">
                        {summary.takeProfit}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-white/5 flex-row items-center justify-between sm:justify-between">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            {data?.comparison ? (
              <>
                <CheckCircle2 className="w-3 h-3 tt-text-up" />
                Snapshot saved &amp; compared
              </>
            ) : loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Minus className="w-3 h-3" />
                Ready
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-8 text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={runReanalyze}
              disabled={loading}
              className="h-8 text-xs gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              ReAnalyze
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReanalyzeDialog;
