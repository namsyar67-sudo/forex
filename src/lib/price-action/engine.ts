/**
 * Price Action Engine
 * Detects candlestick patterns and chart formations from real price data.
 * Each pattern includes a structured interpretation.
 */
import type { Candle } from "@/lib/indicators/indicators";

export type PatternType =
  | "pin_bar_bullish"
  | "pin_bar_bearish"
  | "hammer"
  | "shooting_star"
  | "doji"
  | "morning_star"
  | "evening_star"
  | "bullish_engulfing"
  | "bearish_engulfing"
  | "inside_bar"
  | "outside_bar"
  | "fake_breakout"
  | "retest"
  | "compression"
  | "expansion"
  | "rejection_bullish"
  | "rejection_bearish";

export interface Pattern {
  type: PatternType;
  index: number;
  time: number;
  price: number;
  confidence: number; // 0..1
  direction: "bullish" | "bearish" | "neutral";
  description: string;
  interpretation: string;
}

export interface PriceActionAnalysis {
  symbol: string;
  timeframe: string;
  patterns: Pattern[];
  latestPattern: Pattern | null;
  patternCount: number;
  bullishPatterns: number;
  bearishPatterns: number;
  netBias: "bullish" | "bearish" | "neutral";
  compressionActive: boolean;
  recentVolatility: "low" | "normal" | "high";
}

function bodySize(c: Candle): number {
  return Math.abs(c.close - c.open);
}
function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}
function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}
function totalRange(c: Candle): number {
  return c.high - c.low || 1e-9;
}
function isBullish(c: Candle): boolean {
  return c.close > c.open;
}
function isBearish(c: Candle): boolean {
  return c.close < c.open;
}

export function detectPatterns(candles: Candle[]): Pattern[] {
  const patterns: Pattern[] = [];
  if (candles.length < 5) return patterns;

  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    const c1 = candles[i - 1];
    const c2 = candles[i - 2];
    const body = bodySize(c);
    const range = totalRange(c);
    const uWick = upperWick(c);
    const lWick = lowerWick(c);

    // Doji
    if (body / range < 0.1) {
      patterns.push({
        type: "doji",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.5,
        direction: "neutral",
        description: "Doji — open and close nearly equal",
        interpretation: "Indecision in the market. Potential reversal if it appears after an extended move. Wait for confirmation.",
      });
    }

    // Hammer (bullish reversal at bottom)
    if (lWick > body * 2 && uWick < body * 0.5 && body > 0) {
      patterns.push({
        type: "hammer",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.7,
        direction: "bullish",
        description: "Hammer — long lower wick, small body",
        interpretation: "Bullish reversal signal. Buyers rejected lower prices. Confirmation needed with a bullish close next bar.",
      });
      patterns.push({
        type: "pin_bar_bullish",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.65,
        direction: "bullish",
        description: "Bullish Pin Bar — rejection of lower prices",
        interpretation: "Price swept liquidity below and reversed. Suggests institutional buying interest at this level.",
      });
    }

    // Shooting Star (bearish reversal at top)
    if (uWick > body * 2 && lWick < body * 0.5 && body > 0) {
      patterns.push({
        type: "shooting_star",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.7,
        direction: "bearish",
        description: "Shooting Star — long upper wick, small body",
        interpretation: "Bearish reversal signal. Sellers rejected higher prices. Confirmation needed with a bearish close next bar.",
      });
      patterns.push({
        type: "pin_bar_bearish",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.65,
        direction: "bearish",
        description: "Bearish Pin Bar — rejection of higher prices",
        interpretation: "Price swept liquidity above and reversed. Suggests institutional selling interest at this level.",
      });
    }

    // Bullish Engulfing
    if (isBearish(c1) && isBullish(c) && c.close > c1.open && c.open < c1.close) {
      patterns.push({
        type: "bullish_engulfing",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.75,
        direction: "bullish",
        description: "Bullish Engulfing — current bar engulfs prior bearish bar",
        interpretation: "Strong bullish reversal. Buyers overwhelmed sellers. Often marks the start of an upmove.",
      });
    }

    // Bearish Engulfing
    if (isBullish(c1) && isBearish(c) && c.close < c1.open && c.open > c1.close) {
      patterns.push({
        type: "bearish_engulfing",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.75,
        direction: "bearish",
        description: "Bearish Engulfing — current bar engulfs prior bullish bar",
        interpretation: "Strong bearish reversal. Sellers overwhelmed buyers. Often marks the start of a downmove.",
      });
    }

    // Morning Star (3-bar bullish reversal)
    if (i >= 2 && isBearish(c2) && bodySize(c1) < bodySize(c2) * 0.5 && isBullish(c) && c.close > (c2.open + c2.close) / 2) {
      patterns.push({
        type: "morning_star",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.8,
        direction: "bullish",
        description: "Morning Star — 3-bar bullish reversal",
        interpretation: "High-confidence bullish reversal. Downtrend exhausted, indecision, then strong bullish close.",
      });
    }

    // Evening Star (3-bar bearish reversal)
    if (i >= 2 && isBullish(c2) && bodySize(c1) < bodySize(c2) * 0.5 && isBearish(c) && c.close < (c2.open + c2.close) / 2) {
      patterns.push({
        type: "evening_star",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.8,
        direction: "bearish",
        description: "Evening Star — 3-bar bearish reversal",
        interpretation: "High-confidence bearish reversal. Uptrend exhausted, indecision, then strong bearish close.",
      });
    }

    // Inside Bar
    if (c.high < c1.high && c.low > c1.low) {
      patterns.push({
        type: "inside_bar",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.5,
        direction: "neutral",
        description: "Inside Bar — current bar within prior bar's range",
        interpretation: "Compression / consolidation. Breakout direction often signals the next move. Trade the breakout.",
      });
    }

    // Outside Bar
    if (c.high > c1.high && c.low < c1.low) {
      patterns.push({
        type: "outside_bar",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.6,
        direction: isBullish(c) ? "bullish" : "bearish",
        description: "Outside Bar — current bar engulfs prior bar's range",
        interpretation: "Volatility expansion. Direction depends on close. Often precedes strong directional moves.",
      });
    }

    // Rejection (bullish) — closed in upper third after wicking low
    if (lWick > range * 0.5 && c.close > c.low + range * 0.6) {
      patterns.push({
        type: "rejection_bullish",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.6,
        direction: "bullish",
        description: "Bullish Rejection — closed near highs after testing lows",
        interpretation: "Buyers stepped in aggressively. Short-term bullish bias.",
      });
    }
    // Rejection (bearish)
    if (uWick > range * 0.5 && c.close < c.high - range * 0.6) {
      patterns.push({
        type: "rejection_bearish",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.6,
        direction: "bearish",
        description: "Bearish Rejection — closed near lows after testing highs",
        interpretation: "Sellers stepped in aggressively. Short-term bearish bias.",
      });
    }
  }

  // Fake Breakout — price breaks a recent swing then reverses
  const lookback = 20;
  for (let i = lookback; i < candles.length; i++) {
    const c = candles[i];
    const slice = candles.slice(i - lookback, i);
    const recentHigh = Math.max(...slice.map((s) => s.high));
    const recentLow = Math.min(...slice.map((s) => s.low));
    if (c.high > recentHigh && c.close < recentHigh) {
      patterns.push({
        type: "fake_breakout",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.7,
        direction: "bearish",
        description: "Fake Breakout — broke above resistance then closed below",
        interpretation: "Liquidity sweep above resistance. Bull trap. Bearish signal — sellers in control.",
      });
    }
    if (c.low < recentLow && c.close > recentLow) {
      patterns.push({
        type: "fake_breakout",
        index: i,
        time: c.time,
        price: c.close,
        confidence: 0.7,
        direction: "bullish",
        description: "Fake Breakout — broke below support then closed above",
        interpretation: "Liquidity sweep below support. Bear trap. Bullish signal — buyers in control.",
      });
    }
  }

  // Retest — price returns to a broken level
  // (detected via proximity to prior swing highs/lows within tolerance)
  const swings = [];
  for (let i = 2; i < candles.length - 2; i++) {
    if (
      candles[i].high >= candles[i - 1].high &&
      candles[i].high >= candles[i - 2].high &&
      candles[i].high >= candles[i + 1].high &&
      candles[i].high >= candles[i + 2].high
    ) {
      swings.push({ index: i, price: candles[i].high, type: "high" });
    }
    if (
      candles[i].low <= candles[i - 1].low &&
      candles[i].low <= candles[i - 2].low &&
      candles[i].low <= candles[i + 1].low &&
      candles[i].low <= candles[i + 2].low
    ) {
      swings.push({ index: i, price: candles[i].low, type: "low" });
    }
  }
  for (let i = 0; i < swings.length - 1; i++) {
    const sw = swings[i];
    // Look for a retest 5-30 bars later
    for (let j = sw.index + 5; j < Math.min(candles.length, sw.index + 30); j++) {
      const c = candles[j];
      const tol = sw.price * 0.001;
      if (sw.type === "high" && Math.abs(c.high - sw.price) < tol) {
        patterns.push({
          type: "retest",
          index: j,
          time: c.time,
          price: c.close,
          confidence: 0.6,
          direction: "bearish",
          description: "Retest of prior swing high",
          interpretation: "Price returned to test broken resistance (now resistance again). Potential short entry.",
        });
        break;
      }
      if (sw.type === "low" && Math.abs(c.low - sw.price) < tol) {
        patterns.push({
          type: "retest",
          index: j,
          time: c.time,
          price: c.close,
          confidence: 0.6,
          direction: "bullish",
          description: "Retest of prior swing low",
          interpretation: "Price returned to test broken support (now support again). Potential long entry.",
        });
        break;
      }
    }
  }

  // Compression vs Expansion (ATR-based)
  const ranges = candles.slice(-20).map((c) => totalRange(c));
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const recent5 = ranges.slice(-5).reduce((a, b) => a + b, 0) / 5;
  if (recent5 < avgRange * 0.6) {
    const lastIdx = candles.length - 1;
    patterns.push({
      type: "compression",
      index: lastIdx,
      time: candles[lastIdx].time,
      price: candles[lastIdx].close,
      confidence: 0.65,
      direction: "neutral",
      description: "Compression — volatility contracting",
      interpretation: "Range narrowing. Energy building for a breakout. Prepare for expansion. Set breakout alerts.",
    });
  }
  if (recent5 > avgRange * 1.6) {
    const lastIdx = candles.length - 1;
    patterns.push({
      type: "expansion",
      index: lastIdx,
      time: candles[lastIdx].time,
      price: candles[lastIdx].close,
      confidence: 0.6,
      direction: isBullish(candles[lastIdx]) ? "bullish" : "bearish",
      description: "Expansion — volatility increasing",
      interpretation: "Range expanding. Trend accelerating. Follow the momentum direction.",
    });
  }

  return patterns;
}

export function analyzePriceAction(symbol: string, timeframe: string, candles: Candle[]): PriceActionAnalysis {
  const patterns = detectPatterns(candles);
  const latestPattern = patterns.length > 0 ? patterns[patterns.length - 1] : null;
  const bullishPatterns = patterns.filter((p) => p.direction === "bullish").length;
  const bearishPatterns = patterns.filter((p) => p.direction === "bearish").length;
  const netBias: "bullish" | "bearish" | "neutral" =
    bullishPatterns > bearishPatterns * 1.2 ? "bullish" : bearishPatterns > bullishPatterns * 1.2 ? "bearish" : "neutral";
  const compressionActive = patterns.some((p) => p.type === "compression" && p.index === candles.length - 1);

  const ranges = candles.slice(-20).map((c) => c.high - c.low);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const recent5 = ranges.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const recentVolatility: "low" | "normal" | "high" =
    recent5 < avgRange * 0.7 ? "low" : recent5 > avgRange * 1.5 ? "high" : "normal";

  return {
    symbol,
    timeframe,
    patterns,
    latestPattern,
    patternCount: patterns.length,
    bullishPatterns,
    bearishPatterns,
    netBias,
    compressionActive,
    recentVolatility,
  };
}
