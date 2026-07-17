// Shared frontend types — mirror of backend API responses

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

export interface InstrumentDef {
  symbol: string;
  name: string;
  category: "forex" | "crypto" | "indices" | "metals" | "commodities";
  basePrice: number;
  digits: number;
  pipSize: number;
  lotSize: number;
  spreadPips: number;
  volatility: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Signal = "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
export type Trend = "Bullish" | "Bearish" | "Sideways";
export type VolatilityLevel = "Low" | "Moderate" | "High" | "Extreme";

export interface PairAnalysis {
  symbol: string;
  price: number;
  changePct: number;
  trend: Trend;
  trendStrength: number;
  volatility: VolatilityLevel;
  volatilityScore: number;
  liquidity: "Thin" | "Normal" | "Deep";
  session: string;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  atr: number;
  atrPct: number;
  adx: number;
  stochasticK: number;
  stochasticD: number;
  vwap: number;
  ema20: number;
  ema50: number;
  ema200: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  support: number;
  resistance: number;
  signal: Signal;
  signalScore: number;
  riskScore: number;
  confidence: number;
  spread: number;
  spreadPips: number;
  category: string;
  name: string;
}

export interface AnalysisSummary {
  symbol: string;
  action: "buy" | "sell" | "hold" | "wait";
  confidence: number;
  entryZone: string;
  stopLoss: number;
  takeProfit: number;
  riskScore: number;
  trend: string;
  volatility: string;
  session: string;
  summary: string;
  rationale: string;
  indicators: Record<string, number>;
}

export interface AIInterpretation {
  symbol: string;
  verdict: string;
  scenarios: { name: string; probability: number; description: string }[];
  keyDrivers: string[];
  riskWarnings: string[];
  recommendation: string;
  fullText: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string | null;
  category: string;
  impact: "low" | "medium" | "high";
  symbols: string[];
  publishedAt: string;
}

export interface CalendarItem {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: "low" | "medium" | "high";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  eventTime: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  status: "open" | "closed";
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number;
  pnlPips: number;
  confidence: number;
  rationale: string | null;
  openedAt: string;
  closedAt: string | null;
  livePrice?: number;
}

export interface Decision {
  id: string;
  symbol: string;
  action: string;
  confidence: number;
  entryZone: string;
  stopLoss: number;
  takeProfit: number;
  riskScore: number;
  trend: string;
  volatility: string;
  session: string;
  summary: string;
  rationale: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: string;
  symbol: string | null;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
