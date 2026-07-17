/**
 * Smart Money Concepts (SMC) Engine
 * Detects ICT-style market structure: BOS, CHOCH, order blocks, FVGs,
 * liquidity zones, premium/discount, supply/demand.
 *
 * Pure functions operating on candle arrays. No side effects.
 * All structures are derived from real price action.
 */
import type { Candle } from "@/lib/indicators/indicators";

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
  confirmed: boolean;
}

export interface StructureBreak {
  type: "BOS" | "CHOCH" | "INTERNAL_BOS" | "EXTERNAL_BOS";
  direction: "bullish" | "bearish";
  brokenLevel: number;
  breakIndex: number;
  breakTime: number;
  swingIndex: number;
  significance: number; // 0..1
}

export interface OrderBlock {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  mitigated: boolean;
  mitigationIndex?: number;
  strength: number; // 0..1
}

export interface FairValueGap {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  time: number;
  filled: boolean;
  fillIndex?: number;
  age: number; // bars since creation
}

export interface LiquidityZone {
  type: "buy-side" | "sell-side";
  price: number;
  time: number;
  index: number;
  swept: boolean;
  sweepIndex?: number;
  sweepTime?: number;
  strength: number;
}

export interface EqualLevel {
  type: "equal-highs" | "equal-lows";
  price: number;
  indices: number[];
  times: number[];
  tolerance: number;
}

export interface PremiumDiscount {
  high: number;
  low: number;
  range: number;
  equilibrium: number;
  premiumZone: { top: number; bottom: number };
  discountZone: { top: number; bottom: number };
  currentPrice: number;
  position: number; // 0..1 (0=deep discount, 1=deep premium)
}

export interface MarketPhase {
  phase: "accumulation" | "markup" | "distribution" | "markdown" | "reaccumulation" | "redistribution" | "manipulation" | "expansion";
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface SmartMoneyAnalysis {
  symbol: string;
  timeframe: string;
  swings: SwingPoint[];
  breaks: StructureBreak[];
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  liquidityZones: LiquidityZone[];
  equalLevels: EqualLevel[];
  premiumDiscount: PremiumDiscount;
  phases: MarketPhase[];
  breakerBlocks: OrderBlock[];
  mitigationBlocks: OrderBlock[];
  inducements: { type: "bullish" | "bearish"; price: number; index: number; time: number }[];
  summary: {
    lastBOS: StructureBreak | null;
    lastCHOCH: StructureBreak | null;
    activeOrderBlocks: number;
    activeFVGs: number;
    liquiditySwept: number;
    marketStructure: "bullish" | "bearish" | "ranging";
    bias: "bullish" | "bearish" | "neutral";
    biasStrength: number;
  };
}

// ---------- Swing detection (fractal-based) ----------
export function detectSwings(candles: Candle[], lookback = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }
    if (isHigh) {
      swings.push({ index: i, time: c.time, price: c.high, type: "high", confirmed: true });
    }
    if (isLow) {
      swings.push({ index: i, time: c.time, price: c.low, type: "low", confirmed: true });
    }
  }
  return swings;
}

// ---------- Structure breaks: BOS & CHOCH ----------
export function detectStructureBreaks(swings: SwingPoint[], candles: Candle[]): StructureBreak[] {
  const breaks: StructureBreak[] = [];
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;
  let trend: "bullish" | "bearish" | null = null;

  for (let i = 0; i < swings.length; i++) {
    const sw = swings[i];
    if (sw.type === "high") {
      if (lastHigh) {
        // Check if any candle between lastHigh and now broke above lastHigh
        for (let j = lastHigh.index + 1; j < sw.index; j++) {
          if (candles[j].close > lastHigh.price) {
            const direction: "bullish" = "bullish";
            const isCHOCH = trend === "bearish";
            breaks.push({
              type: isCHOCH ? "CHOCH" : "BOS",
              direction,
              brokenLevel: lastHigh.price,
              breakIndex: j,
              breakTime: candles[j].time,
              swingIndex: lastHigh.index,
              significance: Math.min(1, (candles[j].close - lastHigh.price) / lastHigh.price * 1000),
            });
            trend = "bullish";
            break;
          }
        }
      }
      lastHigh = sw;
    } else {
      if (lastLow) {
        for (let j = lastLow.index + 1; j < sw.index; j++) {
          if (candles[j].close < lastLow.price) {
            const direction: "bearish" = "bearish";
            const isCHOCH = trend === "bullish";
            breaks.push({
              type: isCHOCH ? "CHOCH" : "BOS",
              direction,
              brokenLevel: lastLow.price,
              breakIndex: j,
              breakTime: candles[j].time,
              swingIndex: lastLow.index,
              significance: Math.min(1, (lastLow.price - candles[j].close) / lastLow.price * 1000),
            });
            trend = "bearish";
            break;
          }
        }
      }
      lastLow = sw;
    }
  }

  // Classify internal vs external: external breaks are on major swings (significance > threshold)
  for (const b of breaks) {
    if (b.significance > 0.5) {
      b.type = b.type === "CHOCH" ? "CHOCH" : "EXTERNAL_BOS";
    } else if (b.type === "BOS") {
      b.type = "INTERNAL_BOS";
    }
  }

  return breaks;
}

// ---------- Order Blocks ----------
// A bullish OB = last down candle before a strong up move that breaks structure
export function detectOrderBlocks(candles: Candle[], breaks: StructureBreak[]): OrderBlock[] {
  const obs: OrderBlock[] = [];
  for (const br of breaks) {
    if (br.direction !== "bullish") continue;
    // Find the last down candle before the break
    let obIndex = -1;
    for (let i = br.breakIndex - 1; i >= Math.max(0, br.breakIndex - 10); i--) {
      if (candles[i].close < candles[i].open) {
        obIndex = i;
        break;
      }
    }
    if (obIndex >= 0) {
      const c = candles[obIndex];
      const top = Math.max(c.open, c.close);
      const bottom = Math.min(c.open, c.close);
      // Check mitigation (price returned to OB)
      let mitigated = false;
      let mitigationIndex: number | undefined;
      for (let i = obIndex + 1; i < candles.length; i++) {
        if (candles[i].low <= top && candles[i].low >= bottom) {
          mitigated = true;
          mitigationIndex = i;
          break;
        }
      }
      const strength = Math.min(1, (br.breakIndex - obIndex) / 10);
      obs.push({
        type: "bullish",
        top,
        bottom,
        startIndex: obIndex,
        endIndex: obIndex,
        startTime: c.time,
        endTime: c.time,
        mitigated,
        mitigationIndex,
        strength,
      });
    }
  }
  // Bearish OBs
  for (const br of breaks) {
    if (br.direction !== "bearish") continue;
    let obIndex = -1;
    for (let i = br.breakIndex - 1; i >= Math.max(0, br.breakIndex - 10); i--) {
      if (candles[i].close > candles[i].open) {
        obIndex = i;
        break;
      }
    }
    if (obIndex >= 0) {
      const c = candles[obIndex];
      const top = Math.max(c.open, c.close);
      const bottom = Math.min(c.open, c.close);
      let mitigated = false;
      let mitigationIndex: number | undefined;
      for (let i = obIndex + 1; i < candles.length; i++) {
        if (candles[i].high >= bottom && candles[i].high <= top) {
          mitigated = true;
          mitigationIndex = i;
          break;
        }
      }
      const strength = Math.min(1, (br.breakIndex - obIndex) / 10);
      obs.push({
        type: "bearish",
        top,
        bottom,
        startIndex: obIndex,
        endIndex: obIndex,
        startTime: c.time,
        endTime: c.time,
        mitigated,
        mitigationIndex,
        strength,
      });
    }
  }
  return obs;
}

// ---------- Breaker Blocks ----------
// A breaker = an OB that failed and flipped polarity
export function detectBreakerBlocks(candles: Candle[], orderBlocks: OrderBlock[]): OrderBlock[] {
  const breakers: OrderBlock[] = [];
  for (const ob of orderBlocks) {
    // If a bullish OB was violated (price closed below its bottom), it becomes a bearish breaker
    if (ob.type === "bullish" && !ob.mitigated) {
      for (let i = ob.startIndex + 1; i < candles.length; i++) {
        if (candles[i].close < ob.bottom) {
          breakers.push({
            ...ob,
            type: "bearish",
            mitigated: false,
            strength: ob.strength * 0.8,
          });
          break;
        }
      }
    } else if (ob.type === "bearish" && !ob.mitigated) {
      for (let i = ob.startIndex + 1; i < candles.length; i++) {
        if (candles[i].close > ob.top) {
          breakers.push({
            ...ob,
            type: "bullish",
            mitigated: false,
            strength: ob.strength * 0.8,
          });
          break;
        }
      }
    }
  }
  return breakers;
}

// ---------- Mitigation Blocks ----------
// Zone where price previously faced supply/demand and was mitigated
export function detectMitigationBlocks(orderBlocks: OrderBlock[]): OrderBlock[] {
  return orderBlocks.filter((ob) => ob.mitigated);
}

// ---------- Fair Value Gaps (FVG) ----------
export function detectFVGs(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    // Bullish FVG: gap between c1.high and c3.low (c2 didn't fill)
    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      let filled = false;
      let fillIndex: number | undefined;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].low <= bottom) {
          filled = true;
          fillIndex = j;
          break;
        }
      }
      fvgs.push({
        type: "bullish",
        top,
        bottom,
        startIndex: i - 2,
        endIndex: i,
        time: candles[i].time,
        filled,
        fillIndex,
        age: candles.length - i,
      });
    }
    // Bearish FVG: gap between c1.low and c3.high
    if (c3.high < c1.low) {
      const top = c1.low;
      const bottom = c3.high;
      let filled = false;
      let fillIndex: number | undefined;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= top) {
          filled = true;
          fillIndex = j;
          break;
        }
      }
      fvgs.push({
        type: "bearish",
        top,
        bottom,
        startIndex: i - 2,
        endIndex: i,
        time: candles[i].time,
        filled,
        fillIndex,
        age: candles.length - i,
      });
    }
  }
  return fvgs;
}

// ---------- Liquidity Zones & Sweeps ----------
export function detectLiquidity(swings: SwingPoint[], candles: Candle[]): {
  zones: LiquidityZone[];
  sweeps: LiquidityZone[];
} {
  const zones: LiquidityZone[] = [];
  const sweeps: LiquidityZone[] = [];
  for (const sw of swings) {
    const isBuySide = sw.type === "high";
    const zone: LiquidityZone = {
      type: isBuySide ? "buy-side" : "sell-side",
      price: sw.price,
      time: sw.time,
      index: sw.index,
      swept: false,
      strength: 0.5,
    };
    // Check if swept (price wicked beyond then reversed)
    for (let i = sw.index + 1; i < candles.length; i++) {
      const c = candles[i];
      if (isBuySide && c.high > sw.price && c.close < sw.price) {
        zone.swept = true;
        zone.sweepIndex = i;
        zone.sweepTime = c.time;
        zone.strength = Math.min(1, (c.high - sw.price) / sw.price * 1000 + 0.3);
        sweeps.push({ ...zone });
        break;
      }
      if (!isBuySide && c.low < sw.price && c.close > sw.price) {
        zone.swept = true;
        zone.sweepIndex = i;
        zone.sweepTime = c.time;
        zone.strength = Math.min(1, (sw.price - c.low) / sw.price * 1000 + 0.3);
        sweeps.push({ ...zone });
        break;
      }
    }
    zones.push(zone);
  }
  return { zones, sweeps };
}

// ---------- Equal Highs / Lows ----------
export function detectEqualLevels(swings: SwingPoint[], toleranceRatio = 0.0005): EqualLevel[] {
  const levels: EqualLevel[] = [];
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");
  for (let i = 0; i < highs.length; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      const tol = Math.max(highs[i].price, highs[j].price) * toleranceRatio;
      if (Math.abs(highs[i].price - highs[j].price) <= tol) {
        const existing = levels.find(
          (l) => l.type === "equal-highs" && Math.abs(l.price - highs[i].price) <= tol
        );
        if (existing) {
          if (!existing.indices.includes(highs[j].index)) {
            existing.indices.push(highs[j].index);
            existing.times.push(highs[j].time);
          }
        } else {
          levels.push({
            type: "equal-highs",
            price: (highs[i].price + highs[j].price) / 2,
            indices: [highs[i].index, highs[j].index],
            times: [highs[i].time, highs[j].time],
            tolerance: tol,
          });
        }
      }
    }
  }
  for (let i = 0; i < lows.length; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      const tol = Math.max(lows[i].price, lows[j].price) * toleranceRatio;
      if (Math.abs(lows[i].price - lows[j].price) <= tol) {
        const existing = levels.find(
          (l) => l.type === "equal-lows" && Math.abs(l.price - lows[i].price) <= tol
        );
        if (existing) {
          if (!existing.indices.includes(lows[j].index)) {
            existing.indices.push(lows[j].index);
            existing.times.push(lows[j].time);
          }
        } else {
          levels.push({
            type: "equal-lows",
            price: (lows[i].price + lows[j].price) / 2,
            indices: [lows[i].index, lows[j].index],
            times: [lows[i].time, lows[j].time],
            tolerance: tol,
          });
        }
      }
    }
  }
  return levels;
}

// ---------- Premium / Discount ----------
export function computePremiumDiscount(candles: Candle[], lookback = 100): PremiumDiscount {
  const slice = candles.slice(-lookback);
  const high = Math.max(...slice.map((c) => c.high));
  const low = Math.min(...slice.map((c) => c.low));
  const range = high - low || 1;
  const equilibrium = (high + low) / 2;
  const currentPrice = candles[candles.length - 1].close;
  const position = (currentPrice - low) / range;
  return {
    high,
    low,
    range,
    equilibrium,
    premiumZone: { top: high, bottom: equilibrium + range * 0.25 },
    discountZone: { top: equilibrium - range * 0.25, bottom: low },
    currentPrice,
    position: Math.max(0, Math.min(1, position)),
  };
}

// ---------- Market Phases (Wyckoff-inspired) ----------
export function detectPhases(candles: Candle[], swings: SwingPoint[]): MarketPhase[] {
  const phases: MarketPhase[] = [];
  const window = 20;
  for (let i = window; i < candles.length; i += window) {
    const slice = candles.slice(i - window, i);
    const range = Math.max(...slice.map((c) => c.high)) - Math.min(...slice.map((c) => c.low));
    const avgRange = range / window;
    const returns = slice.slice(1).map((c, idx) => (c.close - slice[idx].close) / slice[idx].close);
    const netReturn = returns.reduce((a, b) => a + b, 0);
    const volatility = Math.sqrt(returns.reduce((a, b) => a + b * b, 0) / returns.length);
    const trendStrength = Math.abs(netReturn) / (volatility || 1);

    let phase: MarketPhase["phase"];
    let confidence = 0.5;
    if (trendStrength > 1.5 && netReturn > 0) {
      phase = "markup";
      confidence = Math.min(1, trendStrength / 3);
    } else if (trendStrength > 1.5 && netReturn < 0) {
      phase = "markdown";
      confidence = Math.min(1, trendStrength / 3);
    } else if (volatility < avgRange * 0.7 / (range / window + 1e-9) && trendStrength < 0.5) {
      phase = i > 0 && phases.length > 0 && phases[phases.length - 1].phase === "markup" ? "distribution" : "accumulation";
      confidence = 0.6;
    } else if (volatility > avgRange * 1.5) {
      phase = "expansion";
      confidence = 0.7;
    } else {
      phase = "reaccumulation";
      confidence = 0.4;
    }
    phases.push({
      phase,
      startIndex: i - window,
      endIndex: i,
      confidence,
    });
  }
  return phases;
}

// ---------- Inducement ----------
// Small liquidity pool that traps traders before the real move
export function detectInducement(swings: SwingPoint[], candles: Candle[]): { type: "bullish" | "bearish"; price: number; index: number; time: number }[] {
  const inducements: { type: "bullish" | "bearish"; price: number; index: number; time: number }[] = [];
  const recentSwings = swings.slice(-10);
  for (let i = 1; i < recentSwings.length; i++) {
    const prev = recentSwings[i - 1];
    const curr = recentSwings[i];
    if (curr.type === "low" && prev.type === "low" && curr.price > prev.price) {
      // Higher low = bullish inducement
      inducements.push({ type: "bullish", price: prev.price, index: prev.index, time: prev.time });
    }
    if (curr.type === "high" && prev.type === "high" && curr.price < prev.price) {
      // Lower high = bearish inducement
      inducements.push({ type: "bearish", price: prev.price, index: prev.index, time: prev.time });
    }
  }
  return inducements;
}

// ---------- Main analysis function ----------
export function analyzeSmartMoney(symbol: string, timeframe: string, candles: Candle[]): SmartMoneyAnalysis {
  // Use only the last 120 candles for performance (SMC is about recent structure)
  const recentCandles = candles.length > 120 ? candles.slice(-120) : candles;
  const swings = detectSwings(recentCandles, 2);
  const breaks = detectStructureBreaks(swings, recentCandles);
  // Limit breaks to most recent 30 for performance
  const limitedBreaks = breaks.slice(-30);
  const orderBlocks = detectOrderBlocks(recentCandles, limitedBreaks).slice(-15);
  const breakerBlocks = detectBreakerBlocks(recentCandles, orderBlocks).slice(-10);
  const mitigationBlocks = detectMitigationBlocks(orderBlocks).slice(-10);
  const fairValueGaps = detectFVGs(recentCandles).slice(-20);
  // Limit swings for liquidity detection to most recent 20
  const recentSwings = swings.slice(-20);
  const { zones, sweeps } = detectLiquidity(recentSwings, recentCandles);
  const equalLevels = detectEqualLevels(recentSwings).slice(-10);
  const premiumDiscount = computePremiumDiscount(candles);
  const phases = detectPhases(candles, swings);
  const inducements = detectInducement(swings, candles);

  const lastBOS = breaks.filter((b) => b.type === "BOS" || b.type === "EXTERNAL_BOS" || b.type === "INTERNAL_BOS").slice(-1)[0] || null;
  const lastCHOCH = breaks.filter((b) => b.type === "CHOCH").slice(-1)[0] || null;

  const activeOrderBlocks = orderBlocks.filter((ob) => !ob.mitigated).length;
  const activeFVGs = fairValueGaps.filter((f) => !f.filled).length;

  const bullishBreaks = breaks.filter((b) => b.direction === "bullish").length;
  const bearishBreaks = breaks.filter((b) => b.direction === "bearish").length;
  const marketStructure: "bullish" | "bearish" | "ranging" =
    bullishBreaks > bearishBreaks * 1.3 ? "bullish" : bearishBreaks > bullishBreaks * 1.3 ? "bearish" : "ranging";

  let bias: "bullish" | "bearish" | "neutral" = "neutral";
  let biasStrength = 0;
  if (lastBOS) {
    bias = lastBOS.direction;
    biasStrength = lastBOS.significance;
  }
  if (lastCHOCH) {
    bias = lastCHOCH.direction;
    biasStrength = Math.max(biasStrength, lastCHOCH.significance);
  }
  // Premium/discount influence
  if (premiumDiscount.position < 0.35 && bias === "bullish") biasStrength += 0.2;
  if (premiumDiscount.position > 0.65 && bias === "bearish") biasStrength += 0.2;

  return {
    symbol,
    timeframe,
    swings,
    breaks,
    orderBlocks,
    fairValueGaps,
    liquidityZones: zones,
    equalLevels,
    premiumDiscount,
    phases,
    breakerBlocks,
    mitigationBlocks,
    inducements,
    summary: {
      lastBOS,
      lastCHOCH,
      activeOrderBlocks,
      activeFVGs,
      liquiditySwept: sweeps.length,
      marketStructure,
      bias,
      biasStrength: Math.min(1, biasStrength),
    },
  };
}
