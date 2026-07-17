/**
 * Signal Engine V3
 * The sole authority for issuing trade recommendations.
 * Aggregates ALL analyses (trend, momentum, smart money, ICT, price action,
 * news, sentiment, liquidity, volatility, risk, correlation, session, spread)
 * into a unified signal with Trade Quality Score (0-100).
 *
 * Pure functions — no side effects. The background worker calls this.
 */
import type { PairAnalysis } from "@/lib/market/analysis";
import type { SmartMoneyAnalysis } from "@/lib/smart-money/engine";
import type { PriceActionAnalysis } from "@/lib/price-action/engine";
import type { MTFAnalysis } from "@/lib/multi-timeframe/engine";
import type { NewsImpactResponse } from "@/lib/news-impact/engine";
import type { SessionAnalysisResult } from "@/lib/session-analysis/engine";
import type { HeatmapResult } from "@/lib/heatmap/engine";

export type SignalType = "STRONG_BUY" | "BUY" | "WAIT" | "SELL" | "STRONG_SELL";
export type SignalDirection = "long" | "short";
export type RiskLevel = "low" | "medium" | "high" | "extreme";

export interface SignalCheck {
  name: string;
  passed: boolean;
  weight: number; // 0..1 contribution to quality
  detail: string;
}

export interface TradingSignal {
  symbol: string;
  signalType: SignalType;
  direction: SignalDirection;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number; // 1:R ratio (e.g. 3 = 1:3)
  confidence: number; // 0..100
  qualityScore: number; // 0..100 Trade Quality Score
  expectedDuration: string;
  expectedProbability: number; // 0..100
  riskLevel: RiskLevel;
  marketSession: string;
  reasons: string[];
  summary: string;
  checks: SignalCheck[];
  indicators: Record<string, number>;
  digits: number;
  timestamp: number;
}

export interface SignalContext {
  analysis: PairAnalysis;
  smc?: SmartMoneyAnalysis | null;
  priceAction?: PriceActionAnalysis | null;
  mtf?: MTFAnalysis | null;
  newsImpact?: NewsImpactResponse | null;
  sessionAnalysis?: SessionAnalysisResult | null;
  heatmap?: HeatmapResult | null;
}

// ---------- Trade Quality Score components ----------
function scoreMTFAlignment(mtf?: MTFAnalysis | null): { score: number; detail: string } {
  if (!mtf) return { score: 0, detail: "MTF data unavailable" };
  const align = mtf.overall.alignment;
  const score = Math.round(align * 0.5); // 0..50
  return {
    score,
    detail: `${mtf.overall.alignment}% aligned (${mtf.overall.trendBias}), decision=${mtf.overall.decision}`,
  };
}

function scoreStructure(smc?: SmartMoneyAnalysis | null, pa?: PriceActionAnalysis | null): { score: number; detail: string } {
  let score = 0;
  const parts: string[] = [];
  if (smc) {
    if (smc.summary.bias !== "neutral") {
      score += 15;
      parts.push(`${smc.summary.bias} bias (${(smc.summary.biasStrength * 100).toFixed(0)}%)`);
    }
    if (smc.summary.activeOrderBlocks > 0) {
      score += 8;
      parts.push(`${smc.summary.activeOrderBlocks} active OBs`);
    }
    if (smc.summary.activeFVGs > 0) {
      score += 5;
      parts.push(`${smc.summary.activeFVGs} FVGs`);
    }
    if (smc.summary.lastBOS) {
      score += 7;
      parts.push(`recent ${smc.summary.lastBOS.type}`);
    }
    if (smc.summary.lastCHOCH) {
      score += 5;
      parts.push(`recent CHOCH`);
    }
    // Premium/discount bonus
    if (smc.premiumDiscount.position < 0.35) {
      score += 5;
      parts.push("discount zone");
    } else if (smc.premiumDiscount.position > 0.65) {
      score += 5;
      parts.push("premium zone");
    }
  }
  if (pa) {
    if (pa.netBias !== "neutral") {
      score += 5;
      parts.push(`${pa.netBias} PA bias`);
    }
    if (pa.latestPattern) {
      score += 5;
      parts.push(`${pa.latestPattern.type.replace(/_/g, " ")}`);
    }
  }
  return { score: Math.min(50, score), detail: parts.join(", ") || "no structure" };
}

function scoreNews(newsImpact?: NewsImpactResponse | null): { score: number; detail: string } {
  if (!newsImpact) return { score: 10, detail: "news data unavailable" };
  // Lower high-impact count = better (safer to trade)
  const highImpact = newsImpact.highImpactCount;
  let score = 20 - highImpact * 4;
  if (score < 0) score = 0;
  return {
    score,
    detail: `${highImpact} high-impact news items, top risk: ${newsImpact.topRiskSymbols.slice(0, 2).map(s => s.symbol).join(",") || "none"}`,
  };
}

function scoreRiskReward(analysis: PairAnalysis, direction: SignalDirection): { score: number; detail: string; rr: number } {
  const atr = analysis.atr || analysis.price * 0.005;
  const slDist = atr * 1.5;
  const tpDist = atr * 3;
  const rr = tpDist / slDist; // ~2.0
  // RR 1:2 = 15pts, 1:3 = 20pts, 1:1 = 10pts
  const score = Math.min(20, Math.round(rr * 7));
  return { score, detail: `1:${rr.toFixed(1)} (ATR ${analysis.atrPct}%)`, rr };
}

function scoreVolatilityLiquidity(analysis: PairAnalysis, sessionAnalysis?: SessionAnalysisResult | null): { score: number; detail: string } {
  let score = 0;
  const parts: string[] = [];
  // Volatility: moderate is best
  if (analysis.volatility === "Moderate") { score += 8; parts.push("moderate vol"); }
  else if (analysis.volatility === "Low") { score += 5; parts.push("low vol"); }
  else if (analysis.volatility === "High") { score += 3; parts.push("high vol"); }
  else { score += 0; parts.push("extreme vol"); }
  // Liquidity
  if (analysis.liquidity === "Deep") { score += 8; parts.push("deep liquidity"); }
  else if (analysis.liquidity === "Normal") { score += 6; parts.push("normal liquidity"); }
  else { score += 2; parts.push("thin liquidity"); }
  // Session
  if (sessionAnalysis) {
    const active = sessionAnalysis.currentSession;
    if (active.volMultiplier > 1.3) { score += 4; parts.push(`${active.name} (high vol session)`); }
    else if (active.volMultiplier > 0.9) { score += 3; parts.push(`${active.name}`); }
    else { score += 1; parts.push(`${active.name} (low vol session)`); }
  }
  return { score: Math.min(20, score), detail: parts.join(", ") };
}

function scoreSentiment(analysis: PairAnalysis, heatmap?: HeatmapResult | null): { score: number; detail: string } {
  let score = 0;
  const parts: string[] = [];
  // RSI sentiment
  if (analysis.rsi < 35) { score += 6; parts.push("RSI oversold recovery"); }
  else if (analysis.rsi > 65) { score += 6; parts.push("RSI overbought"); }
  else { score += 3; parts.push("RSI neutral"); }
  // MACD momentum
  if (analysis.macdHist > 0) { score += 4; parts.push("MACD bullish"); }
  else { score += 4; parts.push("MACD bearish"); }
  // ADX trend strength
  if (analysis.adx > 25) { score += 5; parts.push(`ADX ${analysis.adx} strong trend`); }
  else { score += 2; parts.push(`ADX ${analysis.adx} weak trend`); }
  return { score: Math.min(15, score), detail: parts.join(", ") };
}

// ---------- Main signal generation ----------
export function generateSignal(ctx: SignalContext): TradingSignal {
  const { analysis, smc, priceAction, mtf, newsImpact, sessionAnalysis, heatmap } = ctx;
  const digits = analysis.quote.digits;
  const price = analysis.price;

  // Determine direction from combined bias
  let bullScore = 0;
  let bearScore = 0;

  // Trend
  if (analysis.trend === "Bullish") bullScore += 20;
  else if (analysis.trend === "Bearish") bearScore += 20;

  // Momentum (RSI + MACD)
  if (analysis.rsi < 35) bullScore += 15;
  else if (analysis.rsi > 65) bearScore += 15;
  if (analysis.macdHist > 0) bullScore += 12;
  else bearScore += 12;

  // Smart Money
  if (smc) {
    if (smc.summary.bias === "bullish") bullScore += smc.summary.biasStrength * 25;
    else if (smc.summary.bias === "bearish") bearScore += smc.summary.biasStrength * 25;
    if (smc.premiumDiscount.position < 0.35) bullScore += 8;
    else if (smc.premiumDiscount.position > 0.65) bearScore += 8;
  }

  // Price Action
  if (priceAction) {
    if (priceAction.netBias === "bullish") bullScore += 12;
    else if (priceAction.netBias === "bearish") bearScore += 12;
  }

  // MTF
  if (mtf) {
    if (mtf.overall.trendBias === "bullish") bullScore += mtf.overall.alignment * 0.2;
    else if (mtf.overall.trendBias === "bearish") bearScore += mtf.overall.alignment * 0.2;
  }

  const direction: SignalDirection = bullScore > bearScore ? "long" : bearScore > bullScore ? "short" : "long";
  const isBullish = direction === "long";

  // Compute Trade Quality Score components
  const mtfScore = scoreMTFAlignment(mtf);
  const structScore = scoreStructure(smc, priceAction);
  const newsScore = scoreNews(newsImpact);
  const rrScore = scoreRiskReward(analysis, direction);
  const volLiqScore = scoreVolatilityLiquidity(analysis, sessionAnalysis);
  const sentScore = scoreSentiment(analysis, heatmap);

  const qualityScore = mtfScore.score + structScore.score + newsScore.score + rrScore.score + volLiqScore.score + sentScore.score;

  // Build checks
  const checks: SignalCheck[] = [
    { name: "Trend", passed: analysis.trend !== "Sideways", weight: 0.15, detail: `${analysis.trend} (ADX ${analysis.adx})` },
    { name: "Momentum", passed: Math.abs(analysis.rsi - 50) > 10, weight: 0.10, detail: `RSI ${analysis.rsi}, MACD hist ${analysis.macdHist > 0 ? "+" : ""}${analysis.macdHist.toFixed(5)}` },
    { name: "Smart Money", passed: smc ? smc.summary.bias !== "neutral" : false, weight: 0.20, detail: smc ? `${smc.summary.bias} bias, ${smc.summary.marketStructure} structure` : "unavailable" },
    { name: "ICT Structure", passed: smc ? (smc.summary.activeOrderBlocks > 0 || smc.summary.activeFVGs > 0) : false, weight: 0.10, detail: smc ? `${smc.summary.activeOrderBlocks} OBs, ${smc.summary.activeFVGs} FVGs` : "unavailable" },
    { name: "Price Action", passed: priceAction ? priceAction.netBias !== "neutral" : false, weight: 0.10, detail: priceAction ? `${priceAction.patternCount} patterns, ${priceAction.netBias} bias` : "unavailable" },
    { name: "News", passed: (newsImpact?.highImpactCount || 0) < 3, weight: 0.10, detail: `${newsImpact?.highImpactCount || 0} high-impact items` },
    { name: "Sentiment", passed: sentScore.score > 8, weight: 0.05, detail: sentScore.detail },
    { name: "Liquidity", passed: analysis.liquidity !== "Thin", weight: 0.05, detail: `${analysis.liquidity} liquidity` },
    { name: "Volatility", passed: analysis.volatility !== "Extreme", weight: 0.05, detail: `${analysis.volatility} (${analysis.atrPct}% ATR)` },
    { name: "Risk", passed: analysis.riskScore < 60, weight: 0.05, detail: `Risk score ${analysis.riskScore}/100` },
    { name: "MTF Alignment", passed: (mtf?.overall.alignment || 0) > 50, weight: 0.15, detail: mtf ? `${mtf.overall.alignment}% aligned` : "unavailable" },
    { name: "Session", passed: (sessionAnalysis?.currentSession.volMultiplier || 1) > 0.8, weight: 0.05, detail: `${analysis.session}` },
    { name: "Spread", passed: analysis.spreadPips < 20, weight: 0.05, detail: `${analysis.spreadPips} pips` },
  ];

  // Signal type from quality + direction
  let signalType: SignalType;
  const totalBull = bullScore;
  const totalBear = bearScore;
  const dominant = Math.max(totalBull, totalBear);
  const isBullDir = totalBull >= totalBear;

  if (qualityScore >= 80 && dominant > 60) {
    signalType = isBullDir ? "STRONG_BUY" : "STRONG_SELL";
  } else if (qualityScore >= 60 && dominant > 40) {
    signalType = isBullDir ? "BUY" : "SELL";
  } else if (qualityScore < 40 || dominant < 25) {
    signalType = "WAIT";
  } else {
    signalType = isBullDir ? "BUY" : "SELL";
  }

  // Entry / SL / TP
  const atr = analysis.atr || price * 0.005;
  const entry = price;
  const slDist = atr * 1.5;
  const tp1Dist = atr * 1.5;
  const tp2Dist = atr * 3;
  const tp3Dist = atr * 5;
  const stopLoss = isBullish ? entry - slDist : entry + slDist;
  const takeProfit1 = isBullish ? entry + tp1Dist : entry - tp1Dist;
  const takeProfit2 = isBullish ? entry + tp2Dist : entry - tp2Dist;
  const takeProfit3 = isBullish ? entry + tp3Dist : entry - tp3Dist;
  const riskReward = tp3Dist / slDist; // 1:R at TP3

  // Confidence: blend of quality score and signal dominance
  const confidence = Math.min(100, Math.round(qualityScore * 0.5 + Math.min(100, dominant) * 0.5));

  // Risk level
  let riskLevel: RiskLevel;
  if (analysis.riskScore >= 75) riskLevel = "extreme";
  else if (analysis.riskScore >= 55) riskLevel = "high";
  else if (analysis.riskScore >= 35) riskLevel = "medium";
  else riskLevel = "low";

  // Expected duration based on ATR and timeframe
  const expectedDuration =
    analysis.atrPct < 0.3 ? "hours" : analysis.atrPct < 0.8 ? "intraday" : analysis.atrPct < 1.5 ? "session" : "minutes";

  // Expected probability = confidence adjusted by quality
  const expectedProbability = Math.round(confidence * 0.7 + qualityScore * 0.3);

  // Build reasons
  const reasons: string[] = [];
  if (smc?.summary.lastBOS) {
    reasons.push(`${smc.summary.lastBOS.direction === "bullish" ? "Bullish" : "Bearish"} ${smc.summary.lastBOS.type}`);
  }
  if (smc?.summary.lastCHOCH) {
    reasons.push(`CHOCH (${smc.summary.lastCHOCH.direction})`);
  }
  if (smc && smc.summary.activeOrderBlocks > 0) {
    reasons.push(`${isBullish ? "Bullish" : "Bearish"} Order Block`);
  }
  if (smc && smc.summary.liquiditySwept > 0) {
    reasons.push("Liquidity Sweep");
  }
  if (price > analysis.ema200 && isBullish) reasons.push("EMA200 Support");
  if (price < analysis.ema200 && !isBullish) reasons.push("EMA200 Resistance");
  if (analysis.rsi < 35 && isBullish) reasons.push("RSI Recovery");
  if (analysis.rsi > 65 && !isBullish) reasons.push("RSI Overbought");
  if (analysis.macdHist > 0 && isBullish) reasons.push("MACD Bullish Cross");
  if (analysis.macdHist < 0 && !isBullish) reasons.push("MACD Bearish Cross");
  if (mtf && mtf.overall.alignment > 60) reasons.push(`MTF ${mtf.overall.alignment}% Aligned`);
  if (priceAction?.latestPattern) {
    const pat = priceAction.latestPattern;
    if (pat.direction === (isBullish ? "bullish" : "bearish")) {
      reasons.push(pat.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
    }
  }
  if (analysis.trend === "Bullish" && isBullish) reasons.push("Uptrend Confirmed");
  if (analysis.trend === "Bearish" && !isBullish) reasons.push("Downtrend Confirmed");
  if (smc?.premiumDiscount.position < 0.35 && isBullish) reasons.push("Discount Zone Entry");
  if (smc?.premiumDiscount.position > 0.65 && !isBullish) reasons.push("Premium Zone Entry");
  if ((newsImpact?.highImpactCount || 0) < 2) reasons.push("No High Impact News");
  if (analysis.liquidity === "Deep") reasons.push("Deep Liquidity");
  if (analysis.session.includes("Overlap")) reasons.push("High Volume Session");

  const summary = `${analysis.symbol} ${signalType.replace(/_/g, " ")} — ${direction.toUpperCase()} at ${entry.toFixed(digits)}. Quality ${qualityScore}/100, Confidence ${confidence}%. ${reasons.slice(0, 3).join(", ")}.`;

  return {
    symbol: analysis.symbol,
    signalType,
    direction,
    entryPrice: entry,
    currentPrice: price,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskReward: Math.round(rrScore.rr * 10) / 10,
    confidence,
    qualityScore: Math.round(qualityScore),
    expectedDuration,
    expectedProbability,
    riskLevel,
    marketSession: analysis.session,
    reasons,
    summary,
    checks,
    indicators: {
      rsi: analysis.rsi,
      adx: analysis.adx,
      atr: analysis.atr,
      atrPct: analysis.atrPct,
      macdHist: analysis.macdHist,
      signalScore: analysis.signalScore,
      riskScore: analysis.riskScore,
      mtfAlignment: mtf?.overall.alignment || 0,
      smcBias: smc ? (smc.summary.bias === "bullish" ? 1 : smc.summary.bias === "bearish" ? -1 : 0) : 0,
      premiumDiscount: smc?.premiumDiscount.position || 0.5,
      activeOBs: smc?.summary.activeOrderBlocks || 0,
      activeFVGs: smc?.summary.activeFVGs || 0,
    },
    digits,
    timestamp: Date.now(),
  };
}

// ---------- Notification formatting ----------
export function formatSignalNotification(signal: TradingSignal): {
  title: string;
  message: string;
  priority: string;
} {
  const emoji =
    signal.signalType === "STRONG_BUY" ? "🚀" :
    signal.signalType === "BUY" ? "🟢" :
    signal.signalType === "STRONG_SELL" ? "🔴" :
    signal.signalType === "SELL" ? "🟠" : "⏳";

  const priority =
    signal.qualityScore >= 85 ? "critical" :
    signal.qualityScore >= 70 ? "high" : "medium";

  const d = signal.digits;
  const lines = [
    `${emoji} ${signal.qualityScore >= 85 ? "HIGH CONFIDENCE" : ""} SIGNAL`,
    `${signal.symbol} ${signal.signalType.replace(/_/g, " ")}`,
    `Confidence: ${signal.confidence}%`,
    `Quality: ${signal.qualityScore}/100`,
    `Entry: ${signal.entryPrice.toFixed(d)}`,
    `SL: ${signal.stopLoss.toFixed(d)}`,
    `TP1: ${signal.takeProfit1.toFixed(d)}`,
    `TP2: ${signal.takeProfit2.toFixed(d)}`,
    `TP3: ${signal.takeProfit3.toFixed(d)}`,
    `RR: 1:${signal.riskReward}`,
    `Reasons: ${signal.reasons.slice(0, 5).join(", ")}`,
  ];
  return {
    title: `${emoji} ${signal.symbol} ${signal.signalType.replace(/_/g, " ")} (${signal.confidence}%)`,
    message: lines.join("\n"),
    priority,
  };
}
