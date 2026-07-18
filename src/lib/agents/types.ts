/**
 * Multi-Agent AI Architecture
 *
 * Instead of a single AI model, uses a team of specialized agents that work together:
 * - Chief AI Agent: makes the final decision
 * - Technical Analysis Agent: analyzes the chart
 * - News Analysis Agent: analyzes economic news
 * - Sentiment Analysis Agent: analyzes market sentiment
 * - Risk Management Agent: calculates risk and capital management
 * - Execution Agent: manages execution orders
 * - Trade Monitor Agent: monitors open trades
 * - Learning Agent: learns from trade outcomes and improves performance
 * - Backtesting Agent: tests strategies historically
 * - Portfolio Agent: analyzes portfolios and asset correlations
 *
 * Each agent produces a structured report. The Chief AI Agent collects all reports,
 * computes a unified confidence score, and issues the final decision with full reasoning.
 */

// ---------- Shared Agent Types ----------

export type AgentType =
  | "chief"
  | "technical"
  | "news"
  | "sentiment"
  | "risk"
  | "execution"
  | "monitor"
  | "learning"
  | "backtesting"
  | "portfolio";

export type AgentRecommendation = "BUY" | "SELL" | "HOLD" | "WAIT";

export interface AgentReport {
  agent: AgentType;
  symbol: string;
  recommendation: AgentRecommendation;
  confidence: number;        // 0..100
  score: number;             // -100..100 (bearish..bullish)
  weight: number;            // contribution weight to final decision (0..1)
  summary: string;
  factors: AgentFactor[];
  data: Record<string, any>; // raw analysis snapshot
  timestamp: number;
}

export interface AgentFactor {
  name: string;
  value: string;
  impact: "positive" | "negative" | "neutral";
  weight: number; // 0..1
}

export interface ChiefDecision {
  symbol: string;
  finalRecommendation: AgentRecommendation;
  unifiedConfidence: number;  // 0..100
  qualityScore: number;       // 0..100
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  riskLevel: "low" | "medium" | "high" | "extreme";
  reports: AgentReport[];
  reasoning: string;
  consensus: {
    bullCount: number;
    bearCount: number;
    neutralCount: number;
    alignment: number; // 0..100
  };
  timestamp: number;
}

export interface AgentContext {
  symbol: string;
  price: number;
  digits: number;
  // Pre-computed analyses available to all agents
  analysis?: any;       // PairAnalysis
  smc?: any;            // SmartMoneyAnalysis
  priceAction?: any;    // PriceActionAnalysis
  mtf?: any;            // MTFAnalysis
  newsImpact?: any;     // NewsImpactResponse
  sessionAnalysis?: any;
  heatmap?: any;
  correlationMatrix?: any;
  activeSignals?: any[];
  tradeHistory?: any[];
}

// ---------- Agent Interface ----------

export interface Agent {
  type: AgentType;
  name: string;
  weight: number; // default weight in chief's aggregation
  analyze(ctx: AgentContext): Promise<AgentReport>;
}

// ---------- Helper: normalize score to confidence ----------
export function scoreToConfidence(score: number): number {
  return Math.min(100, Math.round(Math.abs(score) * 0.8 + 20));
}

export function scoreToRecommendation(score: number): AgentRecommendation {
  if (score > 25) return "BUY";
  if (score < -25) return "SELL";
  if (Math.abs(score) < 10) return "WAIT";
  return "HOLD";
}
