/**
 * Currency Strength Heatmap Engine
 * Computes relative strength of each currency based on its pairs' returns.
 * Strong currency = pairs where it's base are up, where it's quote are down.
 */
import { getAllQuotes, getInstrument, type Quote } from "@/lib/market/client";

export interface CurrencyStrength {
  currency: string;
  strength: number; // -100..100 (positive = strong)
  change: number; // avg % change
  pairs: { symbol: string; changePct: number }[];
  rank: number;
  label: "Strong" | "Bullish" | "Neutral" | "Bearish" | "Weak";
}

export interface HeatmapResult {
  currencies: CurrencyStrength[];
  timestamp: number;
  topCurrency: CurrencyStrength | null;
  bottomCurrency: CurrencyStrength | null;
}

// Map each symbol to its base/quote currencies
const SYMBOL_CURRENCIES: Record<string, [string, string]> = {
  EURUSD: ["EUR", "USD"],
  GBPUSD: ["GBP", "USD"],
  USDJPY: ["USD", "JPY"],
  USDCHF: ["USD", "CHF"],
  AUDUSD: ["AUD", "USD"],
  NZDUSD: ["NZD", "USD"],
  USDCAD: ["USD", "CAD"],
  XAUUSD: ["XAU", "USD"],
  XAGUSD: ["XAG", "USD"],
  BTCUSD: ["BTC", "USD"],
  ETHUSD: ["ETH", "USD"],
  NAS100: ["NAS", "USD"],
  US30: ["DJI", "USD"],
  SPX500: ["SPX", "USD"],
  GER40: ["GER", "EUR"],
  UK100: ["UK", "GBP"],
};

const TRACKED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
  "XAU", "XAG", "BTC", "ETH", "NAS", "DJI", "SPX", "GER", "UK",
];

export async function computeHeatmap(): Promise<HeatmapResult> {
  const { quotes } = await getAllQuotes();
  const byCurrency: Record<string, { changes: number[]; pairs: { symbol: string; changePct: number }[] }> = {};

  for (const c of TRACKED_CURRENCIES) {
    byCurrency[c] = { changes: [], pairs: [] };
  }

  for (const q of quotes) {
    const cur = SYMBOL_CURRENCIES[q.symbol];
    if (!cur) continue;
    const [base, quote] = cur;
    // If pair is up, base is strong, quote is weak
    if (byCurrency[base]) {
      byCurrency[base].changes.push(q.changePct);
      byCurrency[base].pairs.push({ symbol: q.symbol, changePct: q.changePct });
    }
    if (byCurrency[quote]) {
      byCurrency[quote].changes.push(-q.changePct);
      byCurrency[quote].pairs.push({ symbol: q.symbol, changePct: -q.changePct });
    }
  }

  const currencies: CurrencyStrength[] = TRACKED_CURRENCIES.map((currency) => {
    const data = byCurrency[currency];
    const avg = data.changes.length
      ? data.changes.reduce((a, b) => a + b, 0) / data.changes.length
      : 0;
    // Normalize to -100..100 (a 2% avg move = ~100 strength)
    const strength = Math.max(-100, Math.min(100, avg * 50));
    let label: CurrencyStrength["label"];
    if (strength > 50) label = "Strong";
    else if (strength > 15) label = "Bullish";
    else if (strength > -15) label = "Neutral";
    else if (strength > -50) label = "Bearish";
    else label = "Weak";
    return {
      currency,
      strength: Math.round(strength),
      change: Math.round(avg * 100) / 100,
      pairs: data.pairs,
      rank: 0,
      label,
    };
  });

  // Rank
  const sorted = [...currencies].sort((a, b) => b.strength - a.strength);
  sorted.forEach((c, i) => {
    c.rank = i + 1;
  });

  return {
    currencies: sorted,
    timestamp: Date.now(),
    topCurrency: sorted[0] || null,
    bottomCurrency: sorted[sorted.length - 1] || null,
  };
}

export { SYMBOL_CURRENCIES, TRACKED_CURRENCIES };
