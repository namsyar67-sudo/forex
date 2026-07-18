/**
 * Market Engine — In-Process Global Singleton (Vercel-compatible)
 *
 * Instead of a separate mini-service with setInterval, the engine lives inside
 * Next.js as a global singleton. It uses LAZY EVALUATION: on each API request,
 * it checks how much time passed since the last tick and advances the simulation
 * accordingly. This works on Vercel serverless (no persistent intervals needed).
 *
 * Each serverless instance gets its own engine state. The warmup runs on first
 * access. Prices are deterministic per symbol (seeded RNG), so different
 * instances produce similar (not identical) streams.
 */
import { DEFAULT_INSTRUMENTS, INSTRUMENT_MAP, type InstrumentDef } from "./instruments";
import type { Candle } from "@/lib/indicators/indicators";

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  spread: number;
  changePct: number;
  changeAbs: number;
  high: number;
  low: number;
  open: number;
  time: number;
  digits: number;
}

export interface SessionInfo {
  name: string;
  vol: number;
}

const TIMEFRAMES: Record<string, number> = {
  m1: 60, m5: 300, m15: 900, h1: 3600, h4: 14400, d1: 86400,
};

type Regime = "trend_up" | "trend_down" | "range" | "volatile";

interface SymbolState {
  instrument: InstrumentDef;
  price: number;
  sessionOpen: number;
  sessionHigh: number;
  sessionLow: number;
  regime: Regime;
  regimeStrength: number;
  momentum: number;
  candles: Record<string, Candle[]>;
  lastTickTime: number;
  rngState: number;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function getSessionMultiplier(hourUTC: number): SessionInfo {
  if (hourUTC >= 13 && hourUTC < 17) return { name: "London-NY Overlap", vol: 1.65 };
  if (hourUTC >= 8 && hourUTC < 13) return { name: "London", vol: 1.3 };
  if (hourUTC >= 17 && hourUTC < 22) return { name: "New York", vol: 1.2 };
  if (hourUTC >= 0 && hourUTC < 8) return { name: "Tokyo", vol: 0.8 };
  return { name: "Sydney", vol: 0.6 };
}

function pickRegime(rng: () => number, current: Regime): Regime {
  if (rng() < 0.85) return current;
  const roll = rng();
  if (roll < 0.4) return "trend_up";
  if (roll < 0.8) return "trend_down";
  if (roll < 0.95) return "range";
  return "volatile";
}

export class MarketEngine {
  private states = new Map<string, SymbolState>();
  public readonly symbols: string[];
  private startEpoch: number;
  private lastTickTime: number;

  constructor() {
    this.startEpoch = Math.floor(Date.now() / 1000);
    this.lastTickTime = Math.floor(Date.now() / 1000);
    this.symbols = DEFAULT_INSTRUMENTS.map((i) => i.symbol);
    for (const inst of DEFAULT_INSTRUMENTS) {
      const rng = mulberry32(inst.symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 7919);
      const candles: Record<string, Candle[]> = {};
      for (const tf of Object.keys(TIMEFRAMES)) candles[tf] = [];
      this.states.set(inst.symbol, {
        instrument: inst,
        price: inst.basePrice,
        sessionOpen: inst.basePrice,
        sessionHigh: inst.basePrice,
        sessionLow: inst.basePrice,
        regime: pickRegime(rng, "range"),
        regimeStrength: 0.3 + rng() * 0.5,
        momentum: 0,
        candles,
        lastTickTime: this.startEpoch,
        rngState: inst.basePrice * 1000,
      });
    }
    this.warmup();
  }

  private rng(symbol: string): () => number {
    const st = this.states.get(symbol)!;
    return () => {
      st.rngState = (st.rngState * 1664525 + 1013904223) >>> 0;
      return st.rngState / 4294967296;
    };
  }

  private warmup() {
    const now = Math.floor(Date.now() / 1000);
    for (const symbol of this.symbols) {
      const st = this.states.get(symbol)!;
      const inst = st.instrument;
      const rng = this.rng(symbol);
      for (const tf of Object.keys(TIMEFRAMES)) {
        const tfSec = TIMEFRAMES[tf];
        const count = tf === "m1" ? 300 : tf === "m5" ? 300 : tf === "m15" ? 300 : tf === "h1" ? 200 : tf === "h4" ? 200 : 150;
        const candles: Candle[] = [];
        let price = inst.basePrice * (0.96 + rng() * 0.08);
        const startTime = now - count * tfSec;
        const alignedStart = Math.floor(startTime / tfSec) * tfSec;
        for (let i = 0; i < count; i++) {
          const t = alignedStart + i * tfSec;
          const dt = tfSec / (365 * 24 * 3600);
          const session = getSessionMultiplier(new Date(t * 1000).getUTCHours());
          const localVol = inst.volatility * session.vol * 1.2;
          let mu = 0;
          const regimeRoll = (i / count + rng() * 0.2) % 1;
          if (regimeRoll < 0.45) mu = inst.volatility * 0.15;
          else if (regimeRoll < 0.9) mu = -inst.volatility * 0.12;
          const open = price;
          let high = open, low = open;
          const steps = tf === "d1" ? 24 : tf === "h1" || tf === "h4" ? 12 : 6;
          for (let s = 0; s < steps; s++) {
            const z = gaussian(rng);
            const ret = (mu * dt + localVol * Math.sqrt(dt) * z) / steps;
            price = price * Math.exp(ret);
            if (price > high) high = price;
            if (price < low) low = price;
          }
          const close = price;
          const volume = Math.max(1, (inst.lotSize / 1000) * (0.5 + rng()) * session.vol * 100);
          candles.push({ time: t, open, high, low, close, volume });
        }
        st.candles[tf] = candles;
        st.price = candles[candles.length - 1].close;
        st.sessionOpen = candles[Math.max(0, candles.length - 24)].open;
        st.sessionHigh = Math.max(...candles.slice(-24).map((c) => c.high));
        st.sessionLow = Math.min(...candles.slice(-24).map((c) => c.low));
      }
    }
  }

  /**
   * LAZY TICK: advances the simulation based on elapsed real time.
   * Called on every API request. Advances 1 tick per second elapsed.
   */
  tick() {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - this.lastTickTime;
    if (elapsed < 1) return; // no time passed

    const hourUTC = new Date().getUTCHours();
    const session = getSessionMultiplier(hourUTC);

    // Advance up to 5 ticks max (to avoid blocking on cold starts)
    const ticksToRun = Math.min(elapsed, 5);

    for (let tickNum = 0; tickNum < ticksToRun; tickNum++) {
      for (const symbol of this.symbols) {
        const st = this.states.get(symbol)!;
        const inst = st.instrument;
        const rng = this.rng(symbol);
        const dt = 1 / (365 * 24 * 3600);
        if (rng() < 0.002) {
          st.regime = pickRegime(rng, st.regime);
          st.regimeStrength = 0.3 + rng() * 0.6;
        }
        let mu = 0;
        switch (st.regime) {
          case "trend_up": mu = inst.volatility * 0.18 * st.regimeStrength; break;
          case "trend_down": mu = -inst.volatility * 0.16 * st.regimeStrength; break;
          case "range": mu = ((st.sessionOpen - st.price) / st.price) * 0.5; break;
          case "volatile": mu = (rng() - 0.5) * inst.volatility * 0.3; break;
        }
        st.momentum = st.momentum * 0.92 + gaussian(rng) * inst.volatility * 0.05;
        mu += st.momentum;
        const localVol = inst.volatility * session.vol * Math.sqrt(dt) * 8;
        const z = gaussian(rng);
        const ret = mu * dt + localVol * z;
        const newPrice = Math.max(st.price * Math.exp(ret), inst.pipSize);
        st.price = newPrice;
        if (newPrice > st.sessionHigh) st.sessionHigh = newPrice;
        if (newPrice < st.sessionLow) st.sessionLow = newPrice;
        st.lastTickTime = now;

        for (const tf of Object.keys(TIMEFRAMES)) {
          const tfSec = TIMEFRAMES[tf];
          const candles = st.candles[tf];
          const bucket = Math.floor(now / tfSec) * tfSec;
          const last = candles[candles.length - 1];
          if (!last || last.time < bucket) {
            const open = last ? last.close : newPrice;
            candles.push({ time: bucket, open, high: Math.max(open, newPrice), low: Math.min(open, newPrice), close: newPrice, volume: inst.lotSize / 1000 * (0.3 + rng()) });
            if (candles.length > 400) candles.shift();
          } else {
            last.close = newPrice;
            if (newPrice > last.high) last.high = newPrice;
            if (newPrice < last.low) last.low = newPrice;
            last.volume += inst.lotSize / 1000 * (0.05 + rng() * 0.1);
          }
        }
      }
    }
    this.lastTickTime = now;
  }

  getQuote(symbol: string): Quote | null {
    const st = this.states.get(symbol);
    if (!st) return null;
    const inst = st.instrument;
    const spreadPrice = inst.spreadPips * inst.pipSize;
    const bid = st.price - spreadPrice / 2;
    const ask = st.price + spreadPrice / 2;
    const changeAbs = st.price - st.sessionOpen;
    const changePct = (changeAbs / st.sessionOpen) * 100;
    return {
      symbol, bid, ask, last: st.price, spread: spreadPrice,
      changePct, changeAbs, high: st.sessionHigh, low: st.sessionLow,
      open: st.sessionOpen, time: st.lastTickTime, digits: inst.digits,
    };
  }

  getAllQuotes(): Quote[] {
    return this.symbols.map((s) => this.getQuote(s)!).filter(Boolean);
  }

  getCandles(symbol: string, timeframe: string, count = 200): Candle[] {
    const st = this.states.get(symbol);
    if (!st) return [];
    const candles = st.candles[timeframe] || [];
    return candles.slice(-count);
  }

  getSession(): SessionInfo {
    return getSessionMultiplier(new Date().getUTCHours());
  }

  getInstruments(): InstrumentDef[] {
    return DEFAULT_INSTRUMENTS;
  }

  getInstrument(symbol: string): InstrumentDef | undefined {
    return INSTRUMENT_MAP[symbol];
  }
}

// Global singleton — survives across API calls within a serverless instance
declare global {
  var __marketEngineV2: MarketEngine | undefined;
}

export function getMarketEngine(): MarketEngine {
  if (!global.__marketEngineV2) {
    global.__marketEngineV2 = new MarketEngine();
  }
  // Lazy tick on every access
  global.__marketEngineV2.tick();
  return global.__marketEngineV2;
}
