/**
 * News & Economic Calendar Service
 * Generates market-aware news briefs and an economic calendar.
 * Uses the AI to synthesize realistic headlines from live market state.
 */
import { getSession } from "@/lib/market/client";
import { analyzeAll } from "@/lib/market/analysis";
import ZAI from "z-ai-web-dev-sdk";

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

const SOURCES = ["Reuters", "Bloomberg", "FXStreet", "DailyFX", "CNBC", "WSJ"];

declare global {
  var __newsCache: { items: NewsItem[]; generatedAt: number } | undefined;
  var __calendarCache: { items: CalendarItem[]; generatedAt: number } | undefined;
}

const NEWS_TTL = 5 * 60 * 1000; // 5 minutes

async function getAI() {
  return ZAI.create();
}

export async function generateNews(): Promise<NewsItem[]> {
  if (global.__newsCache && Date.now() - global.__newsCache.generatedAt < NEWS_TTL) {
    return global.__newsCache.items;
  }

  const analysis = await analyzeAll();
  const movers = [...analysis]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 6);

  const context = movers
    .map(
      (a) =>
        `${a.symbol}: ${a.price} (${a.changePct > 0 ? "+" : ""}${a.changePct.toFixed(2)}%), ${a.trend}, RSI ${a.rsi}, ${a.volatility} vol`
    )
    .join("\n");

  const session = await getSession();

  const prompt = `You are the news wire of a live trading terminal. Current session: ${session.name}.
Here is the live market state:
${context}

Generate 8 realistic, professional market news headlines with short summaries (2 sentences each) that are CONSISTENT with the price action above. Cover forex, metals, crypto, indices, and macro/geopolitics.
Respond in valid JSON only as an array:
[{"title":"...","summary":"...","category":"forex|metals|crypto|indices|macro","impact":"low|medium|high","symbols":["EURUSD",...]}]
No extra text.`;

  try {
    const zai = await getAI();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "You are a financial news wire service. Output JSON only." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content || "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    let items: any[] = [];
    if (match) {
      try {
        items = JSON.parse(match[0]);
      } catch {
        items = [];
      }
    }

    const news: NewsItem[] = items.map((it, idx) => ({
      id: `news-${Date.now()}-${idx}`,
      title: it.title || "Untitled",
      summary: it.summary || "",
      source: SOURCES[idx % SOURCES.length],
      url: null,
      category: it.category || "macro",
      impact: it.impact || "medium",
      symbols: it.symbols || [],
      publishedAt: new Date(Date.now() - idx * 3 * 60 * 1000).toISOString(),
    }));

    if (news.length === 0) {
      return fallbackNews(movers);
    }

    global.__newsCache = { items: news, generatedAt: Date.now() };
    return news;
  } catch (err) {
    return fallbackNews(movers);
  }
}

function fallbackNews(movers: any[]): NewsItem[] {
  const now = Date.now();
  return movers.slice(0, 6).map((m, idx) => ({
    id: `news-fb-${now}-${idx}`,
    title: `${m.symbol} ${m.changePct > 0 ? "rallies" : "drops"} as ${m.trend.toLowerCase()} momentum builds`,
    summary: `${m.symbol} trades at ${m.price} (${m.changePct > 0 ? "+" : ""}${m.changePct.toFixed(
      2
    )}%) with RSI at ${m.rsi} and ${m.volatility.toLowerCase()} volatility in the ${m.session} session.`,
    source: SOURCES[idx % SOURCES.length],
    url: null,
    category: m.symbol.includes("USD") && !m.symbol.startsWith("X") ? "forex" : m.symbol.startsWith("XAU") || m.symbol.startsWith("XAG") ? "metals" : m.symbol.endsWith("USD") ? "crypto" : "indices",
    impact: Math.abs(m.changePct) > 1 ? "high" : "medium",
    symbols: [m.symbol],
    publishedAt: new Date(now - idx * 5 * 60 * 1000).toISOString(),
  }));
}

// Economic calendar — recurring high-impact events with realistic forecasts
const CALENDAR_TEMPLATE = [
  { title: "US CPI m/m", country: "United States", currency: "USD", impact: "high", base: 0.3, unit: "%" },
  { title: "US Core CPI m/m", country: "United States", currency: "USD", impact: "high", base: 0.3, unit: "%" },
  { title: "US Non-Farm Payrolls", country: "United States", currency: "USD", impact: "high", base: 185, unit: "K" },
  { title: "US Unemployment Rate", country: "United States", currency: "USD", impact: "high", base: 3.9, unit: "%" },
  { title: "US FOMC Statement", country: "United States", currency: "USD", impact: "high", base: 5.5, unit: "%" },
  { title: "US Retail Sales m/m", country: "United States", currency: "USD", impact: "medium", base: 0.4, unit: "%" },
  { title: "US GDP q/q", country: "United States", currency: "USD", impact: "high", base: 1.4, unit: "%" },
  { title: "ECB Interest Rate Decision", country: "Eurozone", currency: "EUR", impact: "high", base: 4.25, unit: "%" },
  { title: "EU CPI y/y", country: "Eurozone", currency: "EUR", impact: "high", base: 2.6, unit: "%" },
  { title: "German ZEW Sentiment", country: "Germany", currency: "EUR", impact: "medium", base: 47.5, unit: "" },
  { title: "UK CPI y/y", country: "United Kingdom", currency: "GBP", impact: "high", base: 2.0, unit: "%" },
  { title: "BoE Interest Rate Decision", country: "United Kingdom", currency: "GBP", impact: "high", base: 5.25, unit: "%" },
  { title: "Japan CPI y/y", country: "Japan", currency: "JPY", impact: "medium", base: 2.8, unit: "%" },
  { title: "BoJ Policy Rate", country: "Japan", currency: "JPY", impact: "high", base: 0.1, unit: "%" },
  { title: "Canada CPI m/m", country: "Canada", currency: "CAD", impact: "medium", base: 0.3, unit: "%" },
  { title: "RBA Interest Rate Decision", country: "Australia", currency: "AUD", impact: "high", base: 4.35, unit: "%" },
  { title: "US ISM Manufacturing PMI", country: "United States", currency: "USD", impact: "medium", base: 48.7, unit: "" },
  { title: "US Crude Oil Inventories", country: "United States", currency: "USD", impact: "medium", base: -3.5, unit: "M" },
];

export function generateCalendar(daysAhead = 2): CalendarItem[] {
  if (global.__calendarCache && Date.now() - global.__calendarCache.generatedAt < 30 * 60 * 1000) {
    return global.__calendarCache.items;
  }
  const items: CalendarItem[] = [];
  const now = new Date();
  let counter = 0;
  // Spread events across today + next days at realistic times
  for (let d = 0; d <= daysAhead; d++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    const eventsToday = CALENDAR_TEMPLATE.filter((_, i) => (i + d) % 3 === 0).slice(0, 5);
    for (const ev of eventsToday) {
      const hour = 7 + ((counter * 2) % 10); // between 07:00 and 16:00 UTC
      const time = new Date(day);
      time.setUTCHours(hour, counter % 2 === 0 ? 30 : 0, 0, 0);
      // For past events (today, earlier), include actual
      let actual: string | null = null;
      let previous: string | null = null;
      const forecast = (ev.base + (Math.random() - 0.5) * ev.base * 0.15).toFixed(2);
      if (time.getTime() < now.getTime()) {
        actual = (ev.base + (Math.random() - 0.5) * ev.base * 0.2).toFixed(2);
        previous = (ev.base + (Math.random() - 0.5) * ev.base * 0.1).toFixed(2);
      } else {
        previous = (ev.base + (Math.random() - 0.5) * ev.base * 0.08).toFixed(2);
      }
      items.push({
        id: `cal-${counter}`,
        title: ev.title,
        country: ev.country,
        currency: ev.currency,
        impact: ev.impact as "low" | "medium" | "high",
        actual,
        forecast,
        previous,
        eventTime: time.toISOString(),
      });
      counter++;
    }
  }
  items.sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  global.__calendarCache = { items, generatedAt: Date.now() };
  return items;
}
