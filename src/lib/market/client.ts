/**
 * Market Data Client (server-side only)
 * Uses the in-process MarketEngine global singleton.
 * Vercel-compatible: no external service or port needed.
 */
import { INSTRUMENT_MAP, DEFAULT_INSTRUMENTS, type InstrumentDef } from "@/lib/market/instruments";
import { getMarketEngine, type Quote, type SessionInfo } from "@/lib/market/engine";
import type { Candle } from "@/lib/indicators/indicators";

export type { Quote, SessionInfo };

export async function getAllQuotes(): Promise<{ quotes: Quote[]; session: SessionInfo }> {
  const engine = getMarketEngine();
  return { quotes: engine.getAllQuotes(), session: engine.getSession() };
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const engine = getMarketEngine();
  return engine.getQuote(symbol);
}

export async function getCandles(
  symbol: string,
  timeframe = "h1",
  count = 250
): Promise<{ candles: Candle[]; quote: Quote | null }> {
  const engine = getMarketEngine();
  return {
    candles: engine.getCandles(symbol, timeframe, count),
    quote: engine.getQuote(symbol),
  };
}

export async function getSession(): Promise<SessionInfo> {
  const engine = getMarketEngine();
  return engine.getSession();
}

export function getInstrument(symbol: string): InstrumentDef | undefined {
  return INSTRUMENT_MAP[symbol];
}

export function getAllInstruments(): InstrumentDef[] {
  return DEFAULT_INSTRUMENTS;
}
