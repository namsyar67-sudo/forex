/**
 * Default trading instruments with realistic baseline prices.
 * These are reference prices; the engine simulates live movement from here.
 */
export interface InstrumentDef {
  symbol: string;
  name: string;
  category: "forex" | "crypto" | "indices" | "metals" | "commodities";
  basePrice: number;
  digits: number;
  pipSize: number;
  lotSize: number;
  spreadPips: number; // typical spread in pips
  volatility: number; // annualized volatility estimate (for sim tuning)
}

export const DEFAULT_INSTRUMENTS: InstrumentDef[] = [
  // Forex majors
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "forex", basePrice: 1.0855, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.6, volatility: 0.07 },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", category: "forex", basePrice: 1.2715, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.8, volatility: 0.09 },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", category: "forex", basePrice: 151.42, digits: 3, pipSize: 0.01, lotSize: 100000, spreadPips: 0.7, volatility: 0.08 },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc", category: "forex", basePrice: 0.9035, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.9, volatility: 0.07 },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", category: "forex", basePrice: 0.6585, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.8, volatility: 0.10 },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", category: "forex", basePrice: 0.6045, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 1.0, volatility: 0.11 },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", category: "forex", basePrice: 1.3685, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.9, volatility: 0.07 },
  // Metals
  { symbol: "XAUUSD", name: "Gold / US Dollar", category: "metals", basePrice: 2348.5, digits: 2, pipSize: 0.01, lotSize: 100, spreadPips: 25, volatility: 0.15 },
  { symbol: "XAGUSD", name: "Silver / US Dollar", category: "metals", basePrice: 27.85, digits: 3, pipSize: 0.001, lotSize: 5000, spreadPips: 30, volatility: 0.22 },
  // Crypto
  { symbol: "BTCUSD", name: "Bitcoin / US Dollar", category: "crypto", basePrice: 67250, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 15, volatility: 0.65 },
  { symbol: "ETHUSD", name: "Ethereum / US Dollar", category: "crypto", basePrice: 3285, digits: 2, pipSize: 0.01, lotSize: 1, spreadPips: 20, volatility: 0.75 },
  // Indices
  { symbol: "NAS100", name: "US Tech 100 (Nasdaq)", category: "indices", basePrice: 18450, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 12, volatility: 0.20 },
  { symbol: "US30", name: "US 30 (Dow Jones)", category: "indices", basePrice: 39120, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 15, volatility: 0.16 },
  { symbol: "SPX500", name: "US 500 (S&P 500)", category: "indices", basePrice: 5235, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 10, volatility: 0.17 },
  { symbol: "GER40", name: "Germany 40 (DAX)", category: "indices", basePrice: 18150, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 12, volatility: 0.18 },
  { symbol: "UK100", name: "UK 100 (FTSE)", category: "indices", basePrice: 8185, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 14, volatility: 0.15 },
];

export const INSTRUMENT_MAP: Record<string, InstrumentDef> = Object.fromEntries(
  DEFAULT_INSTRUMENTS.map((i) => [i.symbol, i])
);

export function getAllInstruments(): InstrumentDef[] {
  return DEFAULT_INSTRUMENTS;
}
