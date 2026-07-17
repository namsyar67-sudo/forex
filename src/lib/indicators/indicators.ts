/**
 * Technical Indicators Library
 * Pure functions for quantitative market analysis.
 * All calculations are based on actual price data — no hardcoded results.
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---------- SMA (Simple Moving Average) ----------
export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

// ---------- EMA (Exponential Moving Average) ----------
export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      prev = values[0];
      out.push(values[0]);
    } else {
      prev = values[i] * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

// ---------- RSI (Relative Strength Index) ----------
export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      out.push(NaN);
      continue;
    }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      gains += gain;
      losses += loss;
      if (i === period) {
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
      } else {
        out.push(NaN);
      }
    } else {
      // Wilder's smoothing
      const prevAvgGain = (out[i - 1] !== undefined ? gains : gains) / 1;
      gains = (gains * (period - 1) + gain) / period;
      losses = (losses * (period - 1) + loss) / period;
      const rs = losses === 0 ? 100 : gains / losses;
      out.push(100 - 100 / (1 + rs));
      void prevAvgGain;
    }
  }
  return out;
}

// ---------- ATR (Average True Range) ----------
export function atr(candles: Candle[], period = 14): number[] {
  const out: number[] = [];
  const trs: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
      out.push(NaN);
      continue;
    }
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
    trs.push(tr);

    if (i < period) {
      out.push(NaN);
    } else if (i === period) {
      const sum = trs.slice(1, period + 1).reduce((a, b) => a + b, 0);
      out.push(sum / period);
    } else {
      const prevAtr = out[i - 1];
      out.push((prevAtr * (period - 1) + tr) / period);
    }
  }
  return out;
}

// ---------- MACD ----------
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

// ---------- Bollinger Bands ----------
export function bollinger(
  closes: number[],
  period = 20,
  stdDev = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance =
      slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  }
  return { upper, middle, lower };
}

// ---------- Stochastic Oscillator ----------
export function stochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3
): { k: number[]; d: number[] } {
  const k: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      k.push(NaN);
      continue;
    }
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map((c) => c.high));
    const lowest = Math.min(...slice.map((c) => c.low));
    const close = candles[i].close;
    const val =
      highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100;
    k.push(val);
  }
  const d = sma(
    k.map((v) => (isNaN(v) ? 0 : v)),
    dPeriod
  );
  return { k, d };
}

// ---------- VWAP (Volume Weighted Average Price) ----------
export function vwap(candles: Candle[]): number[] {
  const out: number[] = [];
  let cumVol = 0;
  let cumTPV = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumVol += c.volume;
    cumTPV += tp * c.volume;
    out.push(cumVol === 0 ? c.close : cumTPV / cumVol);
  }
  return out;
}

// ---------- ADX (Average Directional Index) ----------
export function adx(candles: Candle[], period = 14): number[] {
  const out: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trs: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      plusDM.push(0);
      minusDM.push(0);
      trs.push(candles[i].high - candles[i].low);
      out.push(NaN);
      continue;
    }
    const c = candles[i];
    const prev = candles[i - 1];
    const upMove = c.high - prev.high;
    const downMove = prev.low - c.low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trs.push(
      Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      )
    );
  }

  const atrArr = trs.map((_, i) => {
    if (i < period) return NaN;
    return trs.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
  const plusDMArr = plusDM.map((_, i) => {
    if (i < period) return NaN;
    return plusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
  const minusDMArr = minusDM.map((_, i) => {
    if (i < period) return NaN;
    return minusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });

  const dx: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(atrArr[i]) || atrArr[i] === 0) {
      dx.push(NaN);
      continue;
    }
    const plusDI = (plusDMArr[i] / atrArr[i]) * 100;
    const minusDI = (minusDMArr[i] / atrArr[i]) * 100;
    const sum = plusDI + minusDI;
    dx.push(sum === 0 ? 0 : (Math.abs(plusDI - minusDI) / sum) * 100);
  }

  for (let i = 0; i < candles.length; i++) {
    if (i < period * 2 - 1) {
      out.push(NaN);
    } else {
      const slice = dx.slice(i - period + 1, i + 1).filter((v) => !isNaN(v));
      out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
  }
  return out;
}

// ---------- Correlation ----------
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const aSlice = a.slice(-n);
  const bSlice = b.slice(-n);
  const meanA = aSlice.reduce((x, y) => x + y, 0) / n;
  const meanB = bSlice.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = aSlice[i] - meanA;
    const db = bSlice[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

// ---------- Last valid value helper ----------
export function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return 0;
}
