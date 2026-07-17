/**
 * News Impact Engine
 * Scores each news item: impact, affected symbols, duration, risk, confidence.
 */
import type { NewsItem } from "@/lib/market/news";
import { generateNews } from "@/lib/market/news";
import { INSTRUMENT_MAP } from "@/lib/market/instruments";

export interface NewsImpactResult {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: string;
  impactScore: number; // 0..100
  affectedSymbols: string[];
  expectedDuration: string; // "minutes" | "hours" | "session" | "days"
  riskLevel: "low" | "medium" | "high" | "extreme";
  confidence: number; // 0..100
  reasoning: string;
}

export interface NewsImpactResponse {
  items: NewsImpactResult[];
  highImpactCount: number;
  topRiskSymbols: { symbol: string; risk: number }[];
}

// Keywords that signal high impact
const HIGH_IMPACT_KEYWORDS = [
  "rate", "decision", "cpi", "non-farm", "payrolls", "nfp", "fed", "ecb", "boe", "boj",
  "fomc", "gdp", "unemployment", "inflation", "hike", "cut", "emergency", "crisis",
  "war", "sanction", "tariff", "default", "crash", "surge", "plunge", "collapse",
];

const MEDIUM_IMPACT_KEYWORDS = [
  "retail", "pmi", "consumer", "confidence", "manufacturing", "trade", "balance",
  "jobless", "claims", "housing", "industrial", "production", "sentiment",
];

const CURRENCY_MAP: Record<string, string[]> = {
  USD: ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD", "NAS100", "US30", "SPX500"],
  EUR: ["EURUSD", "GER40"],
  GBP: ["GBPUSD", "UK100"],
  JPY: ["USDJPY"],
  CHF: ["USDCHF"],
  CAD: ["USDCAD"],
  AUD: ["AUDUSD"],
  NZD: ["NZDUSD"],
  GOLD: ["XAUUSD"],
  SILVER: ["XAGUSD"],
  OIL: ["XAUUSD", "US30"],
  BITCOIN: ["BTCUSD"],
  CRYPTO: ["BTCUSD", "ETHUSD"],
  NASDAQ: ["NAS100"],
  DOW: ["US30"],
  SP: ["SPX500"],
  DAX: ["GER40"],
  FTSE: ["UK100"],
};

function extractSymbols(text: string, newsSymbols: string[]): string[] {
  const set = new Set<string>(newsSymbols);
  const lower = text.toLowerCase();
  for (const [key, syms] of Object.entries(CURRENCY_MAP)) {
    if (lower.includes(key.toLowerCase())) {
      for (const s of syms) set.add(s);
    }
  }
  // Direct symbol mentions
  for (const sym of Object.keys(INSTRUMENT_MAP)) {
    if (text.includes(sym)) set.add(sym);
  }
  return Array.from(set);
}

function scoreNews(item: NewsItem): Omit<NewsImpactResult, "id"> {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  let impactScore = 30; // base
  const reasons: string[] = [];

  // Keyword scoring
  const highHits = HIGH_IMPACT_KEYWORDS.filter((k) => text.includes(k));
  const medHits = MEDIUM_IMPACT_KEYWORDS.filter((k) => text.includes(k));
  impactScore += highHits.length * 18;
  impactScore += medHits.length * 8;

  // Category
  if (item.category === "macro") impactScore += 10;
  if (item.impact === "high") impactScore += 25;
  else if (item.impact === "medium") impactScore += 12;

  // Magnitude words
  if (/\b(surge|plunge|crash|crisis|emergency|collapse|rally|soar)\b/.test(text)) {
    impactScore += 15;
    reasons.push("Extreme volatility language detected");
  }

  impactScore = Math.min(100, impactScore);

  const riskLevel: NewsImpactResult["riskLevel"] =
    impactScore >= 75 ? "extreme" : impactScore >= 55 ? "high" : impactScore >= 35 ? "medium" : "low";

  const expectedDuration: NewsImpactResult["expectedDuration"] =
    impactScore >= 75 ? "days" : impactScore >= 55 ? "session" : impactScore >= 35 ? "hours" : "minutes";

  const confidence = Math.min(95, 40 + highHits.length * 12 + (item.impact === "high" ? 20 : 10));

  const affectedSymbols = extractSymbols(`${item.title} ${item.summary}`, item.symbols || []);

  const reasoning = [
    `${highHits.length} high-impact keywords, ${medHits.length} medium-impact`,
    `Base category: ${item.category}`,
    `Reported impact: ${item.impact}`,
    highHits.length > 0 ? `Keywords: ${highHits.slice(0, 4).join(", ")}` : "No critical keywords",
  ].join(". ");

  return {
    title: item.title,
    summary: item.summary,
    source: item.source,
    category: item.category,
    publishedAt: item.publishedAt,
    impactScore: Math.round(impactScore),
    affectedSymbols,
    expectedDuration,
    riskLevel,
    confidence,
    reasoning,
  };
}

export async function computeNewsImpact(): Promise<NewsImpactResponse> {
  const news = await generateNews();
  const items: NewsImpactResult[] = news.map((n) => ({ id: n.id, ...scoreNews(n) }));
  items.sort((a, b) => b.impactScore - a.impactScore);

  const highImpactCount = items.filter((i) => i.riskLevel === "high" || i.riskLevel === "extreme").length;

  // Aggregate risk per symbol
  const symbolRisk: Record<string, number> = {};
  for (const item of items) {
    for (const sym of item.affectedSymbols) {
      symbolRisk[sym] = (symbolRisk[sym] || 0) + item.impactScore;
    }
  }
  const topRiskSymbols = Object.entries(symbolRisk)
    .map(([symbol, risk]) => ({ symbol, risk: Math.min(100, risk) }))
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 10);

  return { items, highImpactCount, topRiskSymbols };
}
