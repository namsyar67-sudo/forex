/**
 * Market Data Client (server-side only)
 * Fetches REAL live prices from free APIs (Swissquote + Binance).
 * Falls back to simulation engine for indices and when APIs fail.
 *
 * IMPORTANT: This file imports the market engine (server-only).
 * Client components should import from "@/lib/market/instruments" directly
 * for static instrument data (getAllInstruments, INSTRUMENT_MAP).
 */
import { INSTRUMENT_MAP, type InstrumentDef } from "@/lib/market/instruments";
import { getMarketEngine, type Quote, type SessionInfo } from "@/lib/market/engine";
import { getAllRealQuotes, getRealQuote, type RealQuote } from "@/lib/market/real-prices";
import type { Candle } from "@/lib/indicators/indicators";

export type { Quote, SessionInfo };

export async function getAllQuotes(): Promise<{ quotes: Quote[]; session: SessionInfo }> {
  try {
    const { quotes, session } = await getAllRealQuotes();
    // Convert RealQuote[] to Quote[] (strip isReal field)
    const simpleQuotes: Quote[] = quotes.map((q) => ({
      symbol: q.symbol,
      bid: q.bid,
      ask: q.ask,
      last: q.last,
      spread: q.spread,
      changePct: q.changePct,
      changeAbs: q.changeAbs,
      high: q.high,
      low: q.low,
      open: q.open,
      time: q.time,
      digits: q.digits,
    }));
    return { quotes: simpleQuotes, session };
  } catch {
    // Fallback to engine
    const engine = getMarketEngine();
    return { quotes: engine.getAllQuotes(), session: engine.getSession() };
  }
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  try {
    const rq = await getRealQuote(symbol);
    if (rq) {
      const { isReal, ...quote } = rq;
      return quote as Quote;
    }
  } catch {
    // fallback
  }
  const engine = getMarketEngine();
  return engine.getQuote(symbol);
}

export async function getCandles(
  symbol: string,
  timeframe = "h1",
  count = 250
): Promise<{ candles: Candle[]; quote: Quote | null }> {
  const engine = getMarketEngine();
  const candles = engine.getCandles(symbol, timeframe, count);

  // Try to get real price for the quote
  let quote: Quote | null = null;
  try {
    const rq = await getRealQuote(symbol);
    if (rq) {
      const { isReal, ...q } = rq;
      quote = q as Quote;
    }
  } catch {
    // fallback
  }
  if (!quote) {
    quote = engine.getQuote(symbol);
  }

  // If we have a real price, update the last candle's close
  if (quote && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    lastCandle.close = quote.last;
    if (quote.last > lastCandle.high) lastCandle.high = quote.last;
    if (quote.last < lastCandle.low) lastCandle.low = quote.last;
  }

  return { candles, quote };
}

export async function getSession(): Promise<SessionInfo> {
  const engine = getMarketEngine();
  return engine.getSession();
}

export function getInstrument(symbol: string): InstrumentDef | undefined {
  return INSTRUMENT_MAP[symbol];
}
