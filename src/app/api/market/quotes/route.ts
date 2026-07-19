import { NextResponse } from "next/server";
import { getMarketEngine } from "@/lib/market/engine";
import { INSTRUMENT_MAP, DEFAULT_INSTRUMENTS } from "@/lib/market/instruments";
import type { Quote } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Swissquote mapping
const SQ_MAP: Record<string, string> = {
  EURUSD: "EUR/USD", GBPUSD: "GBP/USD", USDJPY: "USD/JPY", USDCHF: "USD/CHF",
  AUDUSD: "AUD/USD", NZDUSD: "NZD/USD", USDCAD: "USD/CAD",
  XAUUSD: "XAU/USD", XAGUSD: "XAG/USD",
};

const BN_MAP: Record<string, string> = {
  BTCUSD: "BTCUSDT", ETHUSD: "ETHUSDT",
};

// In-memory cache (survives within same serverless instance)
let cachedQuotes: Quote[] | null = null;
let cachedTime = 0;
const CACHE_TTL = 10000; // 10 seconds

export async function GET() {
  const now = Date.now();

  // Return cache if fresh
  if (cachedQuotes && now - cachedTime < CACHE_TTL) {
    return NextResponse.json({ quotes: cachedQuotes, session: getMarketEngine().getSession(), time: now });
  }

  const engine = getMarketEngine();
  engine.tick();

  // Fetch real prices in parallel
  const sqEntries = Object.entries(SQ_MAP);
  const bnEntries = Object.entries(BN_MAP);

  const [sqResults, bnResults] = await Promise.all([
    Promise.all(sqEntries.map(async ([symbol, sqSymbol]) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(
          `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${sqSymbol}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        const spread = data[0].spreadProfilePrices[0];
        const bid = parseFloat(spread.bid);
        const ask = parseFloat(spread.ask);
        const last = (bid + ask) / 2;
        const inst = INSTRUMENT_MAP[symbol];
        const eq = engine.getQuote(symbol);
        const open = eq?.open || last;
        const changeAbs = last - open;
        const changePct = (changeAbs / open) * 100;
        return {
          symbol, bid, ask, last, spread: ask - bid,
          changePct, changeAbs,
          high: Math.max(last, eq?.high || last),
          low: Math.min(last, eq?.low || last),
          open, time: Math.floor(now / 1000), digits: inst.digits,
        } as Quote;
      } catch { return null; }
    })),
    Promise.all(bnEntries.map(async ([symbol, bnSymbol]) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${bnSymbol}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);
        if (!res.ok) return null;
        const d = await res.json();
        const bid = parseFloat(d.bidPrice);
        const ask = parseFloat(d.askPrice);
        const last = (bid + ask) / 2;
        const inst = INSTRUMENT_MAP[symbol];
        const eq = engine.getQuote(symbol);
        return {
          symbol, bid, ask, last, spread: ask - bid,
          changePct: parseFloat(d.priceChangePercent),
          changeAbs: last - (eq?.open || last),
          high: parseFloat(d.highPrice),
          low: parseFloat(d.lowPrice),
          open: eq?.open || last,
          time: Math.floor(now / 1000), digits: inst.digits,
        } as Quote;
      } catch { return null; }
    })),
  ]);

  // Build quotes array
  const quotes: Quote[] = [];
  const realMap = new Map<string, Quote>();

  for (const q of [...sqResults, ...bnResults]) {
    if (q) realMap.set(q.symbol, q);
  }

  for (const inst of DEFAULT_INSTRUMENTS) {
    const real = realMap.get(inst.symbol);
    if (real) {
      quotes.push(real);
    } else {
      const eq = engine.getQuote(inst.symbol);
      if (eq) quotes.push(eq);
    }
  }

  // Cache
  cachedQuotes = quotes;
  cachedTime = now;

  return NextResponse.json({ quotes, session: engine.getSession(), time: now });
}
