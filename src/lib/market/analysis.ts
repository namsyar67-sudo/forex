/**
 * Market Analysis Engine
 * Combines technical indicators into a structured analysis per symbol.
 * Fetches live candle data from the market-stream service.
 *
 * Pure quant analysis — AI is only used to interpret the summary.
 */
import {
  getAllQuotes,
  getCandles,
  getInstrument,
  type Quote,
  type SessionInfo,
} from "@/lib/market/client";
import {
  atr,
  rsi,
  macd,
  ema,
  bollinger,
  adx,
  stochastic,
  vwap,
  sma,
  lastValid,
  correlation,
  type Candle,
} from "@/lib/indicators/indicators";

export type Signal = "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
export type Trend = "Bullish" | "Bearish" | "Sideways";
export type VolatilityLevel = "Low" | "Moderate" | "High" | "Extreme";

export interface PairAnalysis {
  symbol: string;
  price: number;
  changePct: number;
  trend: Trend;
  trendStrength: number;
  volatility: VolatilityLevel;
  volatilityScore: number;
  liquidity: "Thin" | "Normal" | "Deep";
  session: string;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  atr: number;
  atrPct: number;
  adx: number;
  stochasticK: number;
  stochasticD: number;
  vwap: number;
  ema20: number;
  ema50: number;
  ema200: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  support: number;
  resistance: number;
  signal: Signal;
  signalScore: number;
  riskScore: number;
  confidence: number;
  candles: Candle[];
  spread: number;
  spreadPips: number;
  quote: Quote;
  category: string;
  name: string;
}

export interface AnalysisSummary {
  symbol: string;
  action: "buy" | "sell" | "hold" | "wait";
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

const TF = "h1";

function classifyVolatility(atrPct: number): VolatilityLevel {
  if (atrPct < 0.4) return "Low";
  if (atrPct < 0.9) return "Moderate";
  if (atrPct < 1.6) return "High";
  return "Extreme";
}

function classifyLiquidity(sessionVol: number, spreadPips: number): "Thin" | "Normal" | "Deep" {
  if (sessionVol < 0.7 && spreadPips > 15) return "Thin";
  if (sessionVol > 1.3) return "Deep";
  return "Normal";
}

function analyzeFromData(
  symbol: string,
  candles: Candle[],
  quote: Quote,
  session: SessionInfo
): PairAnalysis | null {
  const inst = getInstrument(symbol);
  if (!inst || candles.length < 50) return null;

  const closes = candles.map((c) => c.close);
  const rsiArr = rsi(closes, 14);
  const { macd: macdArr, signal: sigArr, histogram: histArr } = macd(closes);
  const atrArr = atr(candles, 14);
  const adxArr = adx(candles, 14);
  const { k: stochK, d: stochD } = stochastic(candles);
  const vwapArr = vwap(candles);
  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const ema200Arr = ema(closes, 200);
  const bb = bollinger(closes, 20, 2);

  const price = quote.last;
  const rsiVal = lastValid(rsiArr);
  const macdVal = lastValid(macdArr);
  const macdSig = lastValid(sigArr);
  const macdHist = lastValid(histArr);
  const atrVal = lastValid(atrArr);
  const adxVal = lastValid(adxArr);
  const stochKVal = lastValid(stochK);
  const stochDVal = lastValid(stochD);
  const vwapVal = lastValid(vwapArr);
  const ema20 = lastValid(ema20Arr);
  const ema50 = lastValid(ema50Arr);
  const ema200 = lastValid(ema200Arr);
  const bbUpper = lastValid(bb.upper);
  const bbLower = lastValid(bb.lower);
  const bbMiddle = lastValid(bb.middle);

  const atrPct = (atrVal / price) * 100;
  const volatility = classifyVolatility(atrPct);

  let trend: Trend = "Sideways";
  if (price > ema50 && ema20 > ema50 && adxVal > 20) trend = "Bullish";
  else if (price < ema50 && ema20 < ema50 && adxVal > 20) trend = "Bearish";
  if (adxVal < 18) trend = "Sideways";

  const liquidity = classifyLiquidity(session.vol, inst.spreadPips);

  const recent = candles.slice(-50);
  const highs = recent.map((c) => c.high).sort((a, b) => b - a);
  const lows = recent.map((c) => c.low).sort((a, b) => a - b);
  const resistance = highs[Math.floor(highs.length * 0.1)];
  const support = lows[Math.floor(lows.length * 0.1)];

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
  if (stochKVal < 20) score += 8;
  else if (stochKVal > 80) score -= 8;
  if (price > vwapVal) score += 6; else score -= 6;
  const bbPos = (price - bbLower) / (bbUpper - bbLower || 1);
  if (bbPos < 0.1) score += 10;
  else if (bbPos > 0.9) score -= 10;

  score = Math.max(-100, Math.min(100, score));

  let signal: Signal = "NEUTRAL";
  if (score >= 50) signal = "STRONG_BUY";
  else if (score >= 20) signal = "BUY";
  else if (score <= -50) signal = "STRONG_SELL";
  else if (score <= -20) signal = "SELL";

  const volScore = Math.min(100, atrPct * 40);
  const liqScore = liquidity === "Thin" ? 30 : liquidity === "Normal" ? 10 : 0;
  const rsiExtreme = Math.abs(rsiVal - 50) > 25 ? 15 : 0;
  const riskScore = Math.min(100, Math.round(volScore + liqScore + rsiExtreme));

  const confidence = Math.min(
    100,
    Math.round(Math.abs(score) * 0.5 + adxVal * 0.5 + (trend === "Sideways" ? -15 : 10))
  );

  return {
    symbol,
    price,
    changePct: quote.changePct,
    trend,
    trendStrength: Math.round(adxVal),
    volatility,
    volatilityScore: Math.round(volScore),
    liquidity,
    session: session.name,
    rsi: Math.round(rsiVal * 10) / 10,
    macd: macdVal,
    macdSignal: macdSig,
    macdHist: macdHist,
    atr: atrVal,
    atrPct: Math.round(atrPct * 100) / 100,
    adx: Math.round(adxVal),
    stochasticK: Math.round(stochKVal),
    stochasticD: Math.round(stochDVal),
    vwap: vwapVal,
    ema20, ema50, ema200,
    bbUpper, bbLower, bbMiddle,
    support, resistance,
    signal, signalScore: Math.round(score),
    riskScore, confidence: Math.max(0, confidence),
    candles,
    spread: quote.spread,
    spreadPips: inst.spreadPips,
    quote,
    category: inst.category,
    name: inst.name,
  };
}

export async function analyzePair(symbol: string): Promise<PairAnalysis | null> {
  const { candles, quote } = await getCandles(symbol, TF, 150);
  if (!quote || candles.length < 50) return null;
  const session = await getSession();
  return analyzeFromData(symbol, candles, quote, session);
}

export async function analyzeAll(): Promise<PairAnalysis[]> {
  const { quotes, session } = await getAllQuotes();
  const results: PairAnalysis[] = [];
  for (const q of quotes) {
    const { candles } = await getCandles(q.symbol, TF, 250);
    const a = analyzeFromData(q.symbol, candles, q, session);
    if (a) results.push(a);
  }
  return results;
}

export function buildAnalysisSummary(a: PairAnalysis): AnalysisSummary {
  const action =
    a.signal === "STRONG_BUY" || a.signal === "BUY"
      ? "buy"
      : a.signal === "STRONG_SELL" || a.signal === "SELL"
      ? "sell"
      : a.riskScore > 60
      ? "wait"
      : "hold";

  const slDist = a.atr * 1.5;
  const tpDist = a.atr * 3;
  const stopLoss =
    action === "buy" ? a.price - slDist : action === "sell" ? a.price + slDist : a.price;
  const takeProfit =
    action === "buy" ? a.price + tpDist : action === "sell" ? a.price - tpDist : a.price;

  const entryLow = action === "buy" ? a.price - a.atr * 0.3 : a.price + a.atr * 0.3;
  const entryHigh = action === "buy" ? a.price + a.atr * 0.3 : a.price + a.atr * 0.9;

  const summary = `${a.symbol} ${a.trend} trend (ADX ${a.adx}). RSI ${a.rsi}. MACD ${
    a.macdHist > 0 ? "bullish" : "bearish"
  }. Volatility ${a.volatility} (ATR ${a.atrPct}%). Signal: ${a.signal}.`;

  const rationale = [
    `Price ${a.price > a.ema50 ? "above" : "below"} EMA50 (${a.ema50.toFixed(a.quote.digits)}).`,
    `EMA20 ${a.ema20 > a.ema50 ? ">" : "<"} EMA50, EMA50 ${a.ema50 > a.ema200 ? ">" : "<"} EMA200.`,
    `RSI(14) at ${a.rsi} ${a.rsi < 30 ? "oversold" : a.rsi > 70 ? "overbought" : "neutral"}.`,
    `MACD histogram ${a.macdHist > 0 ? "positive" : "negative"} (${a.macdHist.toFixed(5)}).`,
    `Stochastic %K ${a.stochasticK} / %D ${a.stochasticD}.`,
    `Bollinger position: ${(((a.price - a.bbLower) / (a.bbUpper - a.bbLower)) * 100).toFixed(0)}%.`,
    `ATR(14) ${a.atr.toFixed(a.quote.digits)} (${a.atrPct}% of price).`,
    `Support ${a.support.toFixed(a.quote.digits)} / Resistance ${a.resistance.toFixed(a.quote.digits)}.`,
    `Active session: ${a.session} (${a.liquidity} liquidity).`,
  ].join(" ");

  return {
    symbol: a.symbol,
    action,
    confidence: a.confidence,
    entryZone: `${entryLow.toFixed(a.quote.digits)} - ${entryHigh.toFixed(a.quote.digits)}`,
    stopLoss,
    takeProfit,
    riskScore: a.riskScore,
    trend: a.trend,
    volatility: a.volatility,
    session: a.session,
    summary,
    rationale,
    indicators: {
      rsi: a.rsi,
      macd: a.macd,
      macdSignal: a.macdSignal,
      macdHist: a.macdHist,
      atr: a.atr,
      atrPct: a.atrPct,
      adx: a.adx,
      stochasticK: a.stochasticK,
      stochasticD: a.stochasticD,
      vwap: a.vwap,
      ema20: a.ema20,
      ema50: a.ema50,
      ema200: a.ema200,
      bbUpper: a.bbUpper,
      bbLower: a.bbLower,
      signalScore: a.signalScore,
      riskScore: a.riskScore,
      confidence: a.confidence,
    },
  };
}

import { getSession } from "@/lib/market/client";

// Correlation matrix across symbols (based on % returns of H1 closes)
export async function correlationMatrix(symbols: string[]): Promise<number[][]> {
  const returns: Record<string, number[]> = {};
  for (const s of symbols) {
    const { candles } = await getCandles(s, "h1", 100);
    const prices = candles.map((c) => c.close);
    returns[s] = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
  }
  const matrix: number[][] = [];
  for (let i = 0; i < symbols.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < symbols.length; j++) {
      row.push(Math.round(correlation(returns[symbols[i]], returns[symbols[j]]) * 100) / 100);
    }
    matrix.push(row);
  }
  return matrix;
}

export { sma };
