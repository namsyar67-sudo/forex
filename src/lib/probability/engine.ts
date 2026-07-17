/**
 * Probability & Scenario Engine
 * Converts quant signals into Buy/Sell/Wait probabilities and 3 scenarios.
 */
import type { PairAnalysis } from "@/lib/market/analysis";
import type { SmartMoneyAnalysis } from "@/lib/smart-money/engine";
import type { MTFAnalysis } from "@/lib/multi-timeframe/engine";

export interface ProbabilityResult {
  symbol: string;
  buy: number; // 0..100
  sell: number; // 0..100
  wait: number; // 0..100
  dominant: "buy" | "sell" | "wait";
  confidence: number;
}

export interface Scenario {
  name: string;
  probability: number; // 0..100
  direction: "bullish" | "bearish" | "neutral";
  trigger: string;
  target: string;
  invalidation: string;
  description: string;
}

export interface ScenarioResult {
  symbol: string;
  scenarios: Scenario[];
  primaryScenario: Scenario;
}

export function computeProbabilities(
  symbol: string,
  analysis: PairAnalysis,
  smc?: SmartMoneyAnalysis,
  mtf?: MTFAnalysis
): ProbabilityResult {
  // Start from signal score (-100..100)
  let bullScore = 0;
  let bearScore = 0;

  // From signal score
  const s = analysis.signalScore; // -100..100
  if (s > 0) bullScore += s;
  else bearScore += -s;

  // RSI weight
  if (analysis.rsi < 30) bullScore += 15;
  else if (analysis.rsi > 70) bearScore += 15;

  // Trend weight
  if (analysis.trend === "Bullish") bullScore += 12;
  else if (analysis.trend === "Bearish") bearScore += 12;

  // Smart money bias
  if (smc) {
    if (smc.summary.bias === "bullish") bullScore += smc.summary.biasStrength * 25;
    else if (smc.summary.bias === "bearish") bearScore += smc.summary.biasStrength * 25;
    // Premium/discount
    if (smc.premiumDiscount.position < 0.35) bullScore += 8;
    else if (smc.premiumDiscount.position > 0.65) bearScore += 8;
  }

  // MTF alignment
  if (mtf) {
    if (mtf.overall.trendBias === "bullish") bullScore += mtf.overall.alignment * 0.2;
    else if (mtf.overall.trendBias === "bearish") bearScore += mtf.overall.alignment * 0.2;
  }

  const total = bullScore + bearScore + 20; // base for "wait"
  const buy = Math.round((bullScore / total) * 100);
  const sell = Math.round((bearScore / total) * 100);
  let wait = 100 - buy - sell;
  if (wait < 0) wait = 0;

  // Risk factor increases wait
  if (analysis.riskScore > 60) {
    const adj = Math.min(20, (analysis.riskScore - 60) * 0.5);
    const newWait = Math.min(60, wait + adj);
    const diff = newWait - wait;
    wait = newWait;
    // reduce buy/sell proportionally
    const sum = buy + sell;
    if (sum > 0) {
      const buyRatio = buy / sum;
      const sellRatio = sell / sum;
      const adjBuy = Math.round(diff * buyRatio);
      const adjSell = Math.round(diff * sellRatio);
      return {
        symbol,
        buy: Math.max(0, buy - adjBuy),
        sell: Math.max(0, sell - adjSell),
        wait,
        dominant: buy - adjBuy > sell - adjSell && buy - adjBuy > wait ? "buy" : sell - adjSell > wait ? "sell" : "wait",
        confidence: analysis.confidence,
      };
    }
  }

  const dominant: "buy" | "sell" | "wait" =
    buy > sell && buy > wait ? "buy" : sell > wait ? "sell" : "wait";

  return { symbol, buy, sell, wait, dominant, confidence: analysis.confidence };
}

export function generateScenarios(
  symbol: string,
  analysis: PairAnalysis,
  smc?: SmartMoneyAnalysis,
  mtf?: MTFAnalysis
): ScenarioResult {
  const prob = computeProbabilities(symbol, analysis, smc, mtf);
  const digits = analysis.quote.digits;
  const price = analysis.price;
  const atr = analysis.atr || price * 0.005;

  const scenarios: Scenario[] = [];

  // Scenario A — Bullish
  if (prob.buy > 15) {
    const tp = price + atr * 3;
    const sl = price - atr * 1.5;
    scenarios.push({
      name: "Bullish Continuation",
      probability: prob.buy,
      direction: "bullish",
      trigger: `Break & hold above ${analysis.resistance.toFixed(digits)} with bullish confirmation`,
      target: `${tp.toFixed(digits)} (3× ATR)`,
      invalidation: `Close below ${sl.toFixed(digits)}`,
      description: `Price breaks resistance ${analysis.resistance.toFixed(digits)}, ${smc?.summary.bias === "bullish" ? "SMC bias supports" : "momentum builds"} upside. Target ${tp.toFixed(digits)}.`,
    });
  }

  // Scenario B — Bearish
  if (prob.sell > 15) {
    const tp = price - atr * 3;
    const sl = price + atr * 1.5;
    scenarios.push({
      name: "Bearish Reversal",
      probability: prob.sell,
      direction: "bearish",
      trigger: `Break & hold below ${analysis.support.toFixed(digits)} with bearish confirmation`,
      target: `${tp.toFixed(digits)} (3× ATR)`,
      invalidation: `Close above ${sl.toFixed(digits)}`,
      description: `Price breaks support ${analysis.support.toFixed(digits)}, ${smc?.summary.bias === "bearish" ? "SMC bias supports" : "momentum builds"} downside. Target ${tp.toFixed(digits)}.`,
    });
  }

  // Scenario C — Range / Wait
  if (prob.wait > 15 || scenarios.length < 2) {
    scenarios.push({
      name: "Range / Consolidation",
      probability: prob.wait,
      direction: "neutral",
      trigger: `Price respects range ${analysis.support.toFixed(digits)} - ${analysis.resistance.toFixed(digits)}`,
      target: `Mid-range ${((analysis.support + analysis.resistance) / 2).toFixed(digits)}`,
      invalidation: `Decisive break of ${analysis.support.toFixed(digits)} or ${analysis.resistance.toFixed(digits)}`,
      description: `Price compresses between support and resistance. ${analysis.volatility} volatility. Wait for breakout direction.`,
    });
  }

  // Sort by probability
  scenarios.sort((a, b) => b.probability - a.probability);
  const primaryScenario = scenarios[0];

  return { symbol, scenarios, primaryScenario };
}
