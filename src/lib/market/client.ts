/**
 * Market Data Client (server-side only)
 * Fetches live market data from the market-stream service (port 3003).
 * This is the single source of truth — the Next.js process does NOT run its
 * own engine, guaranteeing price consistency between HTTP API and WebSocket.
 */
import { INSTRUMENT_MAP, DEFAULT_INSTRUMENTS, type InstrumentDef } from "@/lib/market/instruments";
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

const STREAM_URL = "http://localhost:3004";
const TIMEOUT_MS = 4000;

async function fetchJSON(path: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${STREAM_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`stream ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getAllQuotes(): Promise<{ quotes: Quote[]; session: SessionInfo }> {
  try {
    const data = await fetchJSON("/quotes");
    return { quotes: data.quotes || [], session: data.session || { name: "Unknown", vol: 1 } };
  } catch {
    return { quotes: [], session: { name: "Offline", vol: 1 } };
  }
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const { quotes } = await getAllQuotes();
  return quotes.find((q) => q.symbol === symbol) || null;
}

export async function getCandles(
  symbol: string,
  timeframe = "h1",
  count = 250
): Promise<{ candles: Candle[]; quote: Quote | null }> {
  try {
    const data = await fetchJSON(`/candles?symbol=${symbol}&tf=${timeframe}&count=${count}`);
    return { candles: data.candles || [], quote: data.quote || null };
  } catch {
    return { candles: [], quote: null };
  }
}

export async function getSession(): Promise<SessionInfo> {
  try {
    return await fetchJSON("/session");
  } catch {
    return { name: "Offline", vol: 1 };
  }
}

export function getInstrument(symbol: string): InstrumentDef | undefined {
  return INSTRUMENT_MAP[symbol];
}

export function getAllInstruments(): InstrumentDef[] {
  return DEFAULT_INSTRUMENTS;
}
