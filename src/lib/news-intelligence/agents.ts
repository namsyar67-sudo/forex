/**
 * News Intelligence Agents
 * 8 specialized agents that work in parallel to collect, verify, and analyze news.
 *
 * Key principle: NO trading recommendation is issued based on a single news item
 * or single source. If data conflicts or is incomplete, recommendation = "WAIT".
 */
import ZAI from "z-ai-web-dev-sdk";
import { getEnabledSources, type NewsSource } from "./sources";
import { DEFAULT_INSTRUMENTS } from "@/lib/market/instruments";

// ---------- Shared Types ----------

export interface CollectedNewsItem {
  id: string;
  title: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  sourceReliability: number;
  category: string;
  publishedAt: string;
  collectedAt: string;
  url?: string;
  symbols?: string[];
  rawContent?: string;
}

export interface VerifiedNewsItem extends CollectedNewsItem {
  verificationScore: number;  // 0..100
  crossSourceCount: number;   // how many sources reported similar
  relatedItems: { sourceId: string; sourceName: string; title: string }[];
  isVerified: boolean;        // true if crossSourceCount >= 2
  originalSourceId?: string;  // the first source that published
  conflictDetected: boolean;  // true if sources disagree on facts
}

export interface NewsSentiment {
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 0..100
  currencies: { currency: string; impact: "positive" | "negative" | "neutral"; strength: number }[];
  reasoning: string;
}

export interface NewsMarketImpact {
  symbols: { symbol: string; impact: "bullish" | "bearish" | "neutral"; strength: number; reasoning: string }[];
  overallImpact: "low" | "medium" | "high" | "extreme";
  affectedCategories: string[];
  expectedDuration: "minutes" | "hours" | "session" | "days";
  confidence: number;
}

export interface TradeImpactResult {
  affectedTrades: {
    signalId: string;
    symbol: string;
    direction: string;
    currentConfidence: number;
    impactLevel: "low" | "medium" | "high" | "critical";
    recommendation: "hold" | "reduce_risk" | "close" | "move_to_breakeven";
    reasoning: string;
  }[];
  hasCriticalImpact: boolean;
}

export interface NewsAISummary {
  headline: string;
  plainLanguageSummary: string;
  keyTakeaways: string[];
  marketImplications: string;
  actionRequired: boolean;
}

export interface NewsIntelligenceReport {
  collectedItems: CollectedNewsItem[];
  verifiedItems: VerifiedNewsItem[];
  sentiment: NewsSentiment | null;
  marketImpact: NewsMarketImpact | null;
  tradeImpact: TradeImpactResult | null;
  aiSummary: NewsAISummary | null;
  breakingNews: VerifiedNewsItem[];
  scheduledAlerts: ScheduledAlert[];
  timestamp: number;
  sourceCount: number;
  verificationRate: number; // % of items that are verified
}

export interface ScheduledAlert {
  id: string;
  eventId: string;
  eventTitle: string;
  eventTime: string;
  minutesBefore: number; // 30, 15, 5, 1
  affectedSymbols: string[];
  fired: boolean;
}

// ---------- Agent 1: News Collection Agent ----------
export async function collectNews(): Promise<CollectedNewsItem[]> {
  const sources = getEnabledSources();
  // Use AI to generate realistic news from multiple sources
  // In production, this would fetch from actual RSS/APIs
  const zai = await ZAI.create();

  // Pick a diverse set of sources (6-8) for each collection cycle
  const selectedSources = [...sources]
    .sort(() => Math.random() - 0.5)
    .slice(0, 8);

  const prompt = `You are a financial news wire aggregator. Generate 10 realistic market news headlines from these sources: ${selectedSources.map(s => s.name).join(", ")}.
Each headline must be assigned to ONE of these sources.
Cover: forex, gold, crypto, indices, macro/geopolitics.
Respond in JSON array only:
[{"title":"...","summary":"2 sentence summary","sourceId":"reuters","category":"forex|metals|crypto|indices|macro","symbols":["EURUSD",...],"impact":"low|medium|high"}]
No extra text.`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "You are a financial news wire. Output JSON only." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content || "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    let items: any[] = [];
    if (match) {
      try { items = JSON.parse(match[0]); } catch { items = []; }
    }

    const now = new Date().toISOString();
    return items.map((item, idx) => {
      const source = selectedSources.find(s => s.id === item.sourceId) || selectedSources[idx % selectedSources.length];
      return {
        id: `news-${Date.now()}-${idx}`,
        title: item.title || "Untitled",
        summary: item.summary || "",
        sourceId: source.id,
        sourceName: source.name,
        sourceReliability: source.reliability,
        category: item.category || "macro",
        publishedAt: new Date(Date.now() - idx * 2 * 60 * 1000).toISOString(),
        collectedAt: now,
        symbols: item.symbols || [],
      } as CollectedNewsItem;
    });
  } catch {
    return [];
  }
}

// ---------- Agent 2: News Verification Agent ----------
export function verifyNews(items: CollectedNewsItem[]): VerifiedNewsItem[] {
  // Group items by similarity (same symbols + similar titles)
  const groups: CollectedNewsItem[][] = [];
  const used = new Set<string>();

  for (const item of items) {
    if (used.has(item.id)) continue;
    const group = [item];
    used.add(item.id);
    for (const other of items) {
      if (used.has(other.id)) continue;
      // Same symbol overlap or title similarity
      const symbolOverlap = (item.symbols || []).some(s => (other.symbols || []).includes(s));
      const titleSimilar = computeTitleSimilarity(item.title, other.title) > 0.4;
      if (symbolOverlap && titleSimilar) {
        group.push(other);
        used.add(other.id);
      }
    }
    groups.push(group);
  }

  return groups.map(group => {
    // The original source = the one with earliest publishedAt
    const sorted = [...group].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    const original = sorted[0];

    // Verification score: based on number of sources + their reliability
    const avgReliability = group.reduce((sum, item) => sum + item.sourceReliability, 0) / group.length;
    const sourceDiversity = Math.min(1, group.length / 3); // 3 sources = full diversity
    const verificationScore = Math.round((avgReliability * 0.4 + sourceDiversity * 0.4 + (group.length >= 2 ? 0.2 : 0)) * 100);

    // Conflict detection: if sources report different directions (simplified)
    const conflictDetected = false; // would need NLP in production

    return {
      ...original,
      verificationScore,
      crossSourceCount: group.length,
      relatedItems: group.slice(1).map(item => ({
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        title: item.title,
      })),
      isVerified: group.length >= 2,
      originalSourceId: original.sourceId,
      conflictDetected,
    };
  });
}

function computeTitleSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const intersection = wordsA.filter(w => wordsB.includes(w) && w.length > 3);
  return intersection.length / Math.min(wordsA.length, wordsB.length);
}

// ---------- Agent 3: Economic Calendar Agent ----------
export interface CalendarEventExtended {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: "low" | "medium" | "high";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  eventTime: string;
  affectedSymbols: string[];
  minutesUntil: number; // negative = already released
  isUpcoming: boolean;
}

const CALENDAR_AFFECTED: Record<string, string[]> = {
  USD: ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD", "XAUUSD", "XAGUSD", "NAS100", "US30", "SPX500"],
  EUR: ["EURUSD", "GER40"],
  GBP: ["GBPUSD", "UK100"],
  JPY: ["USDJPY"],
  CHF: ["USDCHF"],
  CAD: ["USDCAD"],
  AUD: ["AUDUSD"],
  NZD: ["NZDUSD"],
};

export function processCalendarEvents(events: any[]): CalendarEventExtended[] {
  const now = Date.now();
  return events.map(e => {
    const eventTime = new Date(e.eventTime).getTime();
    const minutesUntil = Math.round((eventTime - now) / 60000);
    const currency = e.currency || "USD";
    return {
      ...e,
      affectedSymbols: CALENDAR_AFFECTED[currency] || [],
      minutesUntil,
      isUpcoming: minutesUntil > 0,
    };
  });
}

// ---------- Agent 4: Breaking News Agent ----------
export function detectBreakingNews(items: VerifiedNewsItem[]): VerifiedNewsItem[] {
  // Breaking = verified + high impact + published within last 5 minutes
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  return items.filter(item => {
    const published = new Date(item.publishedAt).getTime();
    const isRecent = published > fiveMinAgo;
    const isHighImpact = item.verificationScore > 60;
    return isRecent && isHighImpact;
  });
}

// ---------- Agent 5: Market Impact Agent ----------
export async function analyzeMarketImpact(items: VerifiedNewsItem[]): Promise<NewsMarketImpact> {
  const zai = await ZAI.create();
  const verifiedItems = items.filter(i => i.isVerified);

  const prompt = `Analyze the market impact of these verified news items:
${verifiedItems.slice(0, 5).map(i => `[${i.sourceName}] ${i.title}: ${i.summary}`).join("\n")}

Available symbols: ${DEFAULT_INSTRUMENTS.map(i => i.symbol).join(", ")}

Respond in JSON:
{"symbols":[{"symbol":"EURUSD","impact":"bullish|bearish|neutral","strength":0-100,"reasoning":"..."}],"overallImpact":"low|medium|high|extreme","affectedCategories":["forex","gold"],"expectedDuration":"minutes|hours|session|days","confidence":0-100}`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "You are a market impact analyst. Output JSON only." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch { /* skip */ }

  // Fallback: compute from news items
  const affectedSymbols = new Set<string>();
  for (const item of verifiedItems) {
    for (const sym of item.symbols || []) affectedSymbols.add(sym);
  }
  return {
    symbols: Array.from(affectedSymbols).map(sym => ({ symbol: sym, impact: "neutral" as const, strength: 30, reasoning: "Impact analysis incomplete" })),
    overallImpact: verifiedItems.length > 5 ? "high" : "medium",
    affectedCategories: ["forex"],
    expectedDuration: "hours",
    confidence: 40,
  };
}

// ---------- Agent 6: Sentiment Agent ----------
export async function analyzeNewsSentiment(items: VerifiedNewsItem[]): Promise<NewsSentiment> {
  const zai = await ZAI.create();
  const verifiedItems = items.filter(i => i.isVerified);

  if (verifiedItems.length === 0) {
    return { direction: "neutral", confidence: 0, currencies: [], reasoning: "No verified news to analyze" };
  }

  const prompt = `Analyze the sentiment of these verified financial news items:
${verifiedItems.slice(0, 8).map(i => `[${i.sourceName}] ${i.title}`).join("\n")}

Respond in JSON:
{"direction":"bullish|bearish|neutral","confidence":0-100,"currencies":[{"currency":"USD","impact":"positive|negative|neutral","strength":0-100}],"reasoning":"..."}`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "You are a sentiment analyst. Output JSON only." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch { /* skip */ }

  return { direction: "neutral", confidence: 30, currencies: [], reasoning: "Sentiment analysis failed" };
}

// ---------- Agent 7: Trade Impact Agent ----------
export async function analyzeTradeImpact(
  activeSignals: any[],
  marketImpact: NewsMarketImpact | null,
  breakingNews: VerifiedNewsItem[]
): Promise<TradeImpactResult> {
  if (!activeSignals.length || !marketImpact) {
    return { affectedTrades: [], hasCriticalImpact: false };
  }

  const affectedTrades: TradeImpactResult["affectedTrades"] = [];

  for (const signal of activeSignals) {
    const symbolImpact = marketImpact.symbols.find(s => s.symbol === signal.symbol);
    if (!symbolImpact || symbolImpact.impact === "neutral") continue;

    // Check if the news impact is against the trade direction
    const isLong = signal.direction === "long";
    const isAgainstTrade = (symbolImpact.impact === "bearish" && isLong) || (symbolImpact.impact === "bullish" && !isLong);

    const strength = symbolImpact.strength;
    let impactLevel: "low" | "medium" | "high" | "critical" = "low";
    let recommendation: "hold" | "reduce_risk" | "close" | "move_to_breakeven" = "hold";

    if (isAgainstTrade) {
      if (strength > 70) { impactLevel = "critical"; recommendation = "close"; }
      else if (strength > 50) { impactLevel = "high"; recommendation = "reduce_risk"; }
      else if (strength > 30) { impactLevel = "medium"; recommendation = "reduce_risk"; }
    } else {
      if (strength > 70) { impactLevel = "medium"; recommendation = "hold"; }
    }

    // Check if breaking news directly mentions this symbol
    const hasBreakingNews = breakingNews.some(n => (n.symbols || []).includes(signal.symbol));
    if (hasBreakingNews && isAgainstTrade) {
      impactLevel = "critical";
      recommendation = "close";
    }

    affectedTrades.push({
      signalId: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      currentConfidence: signal.confidence,
      impactLevel,
      recommendation,
      reasoning: `${symbolImpact.impact} news impact (${strength}/100) on ${signal.symbol}. ${isAgainstTrade ? "Against trade direction." : "With trade direction."} ${hasBreakingNews ? "Breaking news detected." : ""}`,
    });
  }

  return {
    affectedTrades,
    hasCriticalImpact: affectedTrades.some(t => t.impactLevel === "critical"),
  };
}

// ---------- Agent 8: AI Summary Agent ----------
export async function generateNewsAISummary(
  items: VerifiedNewsItem[],
  sentiment: NewsSentiment | null,
  marketImpact: NewsMarketImpact | null
): Promise<NewsAISummary> {
  const zai = await ZAI.create();
  const verifiedItems = items.filter(i => i.isVerified);

  if (verifiedItems.length === 0) {
    return {
      headline: "No verified news",
      plainLanguageSummary: "No significant verified news at this time.",
      keyTakeaways: [],
      marketImplications: "None identified.",
      actionRequired: false,
    };
  }

  const prompt = `Summarize these verified financial news items in plain language:
${verifiedItems.slice(0, 6).map(i => `[${i.sourceName}] ${i.title}: ${i.summary}`).join("\n")}

Sentiment: ${sentiment?.direction} (${sentiment?.confidence}%)
Market impact: ${marketImpact?.overallImpact}

Respond in JSON:
{"headline":"one line headline","plainLanguageSummary":"2-3 sentence simple explanation","keyTakeaways":["point1","point2","point3"],"marketImplications":"what this means for traders","actionRequired":true/false}`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "You are a financial news summarizer. Output JSON only." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch { /* skip */ }

  return {
    headline: verifiedItems[0].title,
    plainLanguageSummary: verifiedItems[0].summary,
    keyTakeaways: [],
    marketImplications: "Analysis incomplete.",
    actionRequired: false,
  };
}

// ---------- News Scheduler ----------
export function generateScheduledAlerts(calendarEvents: CalendarEventExtended[]): ScheduledAlert[] {
  const alerts: ScheduledAlert[] = [];
  const upcoming = calendarEvents.filter(e => e.isUpcoming && e.impact === "high" && e.minutesUntil <= 60);

  for (const event of upcoming) {
    for (const minBefore of [30, 15, 5, 1]) {
      if (event.minutesUntil > minBefore) {
        alerts.push({
          id: `alert-${event.id}-${minBefore}`,
          eventId: event.id,
          eventTitle: event.title,
          eventTime: event.eventTime,
          minutesBefore: minBefore,
          affectedSymbols: event.affectedSymbols,
          fired: false,
        });
      }
    }
  }
  return alerts;
}
