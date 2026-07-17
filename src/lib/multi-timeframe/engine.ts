/**
 * Multi-Timeframe Analysis Engine
 * Aggregates trend/signal/confidence/risk across timeframes.
 */
import type { Candle } from "@/lib/indicators/indicators";
import { getCandles, getSession, type Quote, type SessionInfo } from "@/lib/market/client";
import { rsi, macd, ema, atr, adx, lastValid } from "@/lib/indicators/indicators";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzePriceAction } from "@/lib/price-action/engine";

export interface TFResult {
  timeframe: string;
  trend: "Bullish" | "Bearish" | "Sideways";
  signal: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  confidence: number;
  riskScore: number;
  rsi: number;
  adx: number;
  bias: "bullish" | "bearish" | "neutral";
  score: number; // -100..100
}

export interface MTFAnalysis {
  symbol: string;
  timeframes: TFResult[];
  overall: {
    decision: "buy" | "sell" | "hold" | "wait";
    confidence: number;
    alignment: number; // 0..100 (how aligned timeframes are)
    trendBias: "bullish" | "bearish" | "neutral";
    riskScore: number;
    summary: string;
  };
  weightedScore: number; // -100..100 (higher TFs weighted more)
}

export const MTF_TIMEFRAMES = ["m1", "m5", "m15", "m30", "h1", "h4", "d1"];

const TF_WEIGHTS: Record<string, number> = {
  m1: 0.5,
  m5: 0.7,
  m15: 0.85,
  m30: 1.0,
  h1: 1.2,
  h4: 1.5,
  d1: 1.8,
};

function analyzeTF(symbol: string, timeframe: string, candles: Candle[]): TFResult | null {
  if (candles.length < 50) return null;
  const closes = candles.map((c) => c.close);
  const rsiArr = rsi(closes, 14);
  const { histogram } = macd(closes);
  const atrArr = atr(candles, 14);
  const adxArr = adx(candles, 14);
  const ema20 = lastValid(ema(closes, 20));
  const ema50 = lastValid(ema(closes, 50));
  const ema200 = lastValid(ema(closes, 200));
  const price = closes[closes.length - 1];
  const rsiVal = lastValid(rsiArr);
  const macdHist = lastValid(histogram);
  const atrVal = lastValid(atrArr);
  const adxVal = lastValid(adxArr);
  const atrPct = (atrVal / price) * 100;

  let trend: TFResult["trend"] = "Sideways";
  if (price > ema50 && ema20 > ema50 && adxVal > 20) trend = "Bullish";
  else if (price < ema50 && ema20 < ema50 && adxVal > 20) trend = "Bearish";
  if (adxVal < 18) trend = "Sideways";

  let score = 0;
  if (trend === "Bullish") score += 25;
  else if (trend === "Bearish") score -= 25;
  if (price > ema20) score += 8; else score -= 8;
  if (ema20 > ema50) score += 10; else score -= 10;
  if (ema50 > ema200) score += 7; else score -= 7;
  if (rsiVal < 30) score += 18;
  else if (rsiVal > 70) score -= 18;
  else if (rsiVal < 45) score += 5;
  else if (rsiVal > 55) score -= 5;
  if (macdHist > 0) score += 12; else score -= 12;
  score = Math.max(-100, Math.min(100, score));

  let signal: TFResult["signal"] = "NEUTRAL";
  if (score >= 50) signal = "STRONG_BUY";
  else if (score >= 20) signal = "BUY";
  else if (score <= -50) signal = "STRONG_SELL";
  else if (score <= -20) signal = "SELL";

  const volScore = Math.min(100, atrPct * 40);
  const riskScore = Math.min(100, Math.round(volScore + (adxVal < 15 ? 15 : 0)));
  const confidence = Math.min(100, Math.round(Math.abs(score) * 0.5 + adxVal * 0.5));

  const bias: "bullish" | "bearish" | "neutral" =
    score > 15 ? "bullish" : score < -15 ? "bearish" : "neutral";

  return {
    timeframe,
    trend,
    signal,
    confidence,
    riskScore,
    rsi: Math.round(rsiVal * 10) / 10,
    adx: Math.round(adxVal),
    bias,
    score,
  };
}

export async function analyzeMultiTimeframe(symbol: string): Promise<MTFAnalysis> {
  const results: TFResult[] = [];
  let weightedScoreSum = 0;
  let weightSum = 0;

  for (const tf of MTF_TIMEFRAMES) {
    const { candles } = await getCandles(symbol, tf, 150);
    const r = analyzeTF(symbol, tf, candles);
    if (r) {
      results.push(r);
      const w = TF_WEIGHTS[tf] || 1;
      weightedScoreSum += r.score * w;
      weightSum += w;
    }
  }

  const weightedScore = weightSum > 0 ? weightedScoreSum / weightSum : 0;

  // Alignment: how many TFs agree with the weighted direction
  const direction = weightedScore > 0 ? "bullish" : weightedScore < 0 ? "bearish" : "neutral";
  const aligned = results.filter((r) => r.bias === direction).length;
  const alignment = results.length > 0 ? Math.round((aligned / results.length) * 100) : 0;

  let decision: "buy" | "sell" | "hold" | "wait";
  if (weightedScore >= 30 && alignment >= 60) decision = "buy";
  else if (weightedScore <= -30 && alignment >= 60) decision = "sell";
  else if (Math.abs(weightedScore) < 15) decision = "wait";
  else decision = "hold";

  const confidence = Math.min(100, Math.round(Math.abs(weightedScore) * 0.6 + alignment * 0.4));
  const avgRisk = results.length
    ? Math.round(results.reduce((a, r) => a + r.riskScore, 0) / results.length)
    : 50;

  const summary = `MTF alignment ${alignment}% ${direction}. Weighted score ${weightedScore.toFixed(0)}/100. Decision: ${decision.toUpperCase()} (confidence ${confidence}%).`;

  return {
    symbol,
    timeframes: results,
    overall: {
      decision,
      confidence,
      alignment,
      trendBias: direction,
      riskScore: avgRisk,
      summary,
    },
    weightedScore: Math.round(weightedScore),
  };
}
