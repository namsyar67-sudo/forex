/**
 * Session Analysis Engine
 * Analyzes each trading session's characteristics from live data.
 */
import { getAllQuotes, getCandles, getSession } from "@/lib/market/client";
import { atr, lastValid } from "@/lib/indicators/indicators";

export interface SessionStats {
  name: string;
  active: boolean;
  volMultiplier: number;
  trend: "Bullish" | "Bearish" | "Mixed";
  avgVolume: number;
  volatility: number; // 0..100
  liquidity: "Thin" | "Normal" | "Deep";
  rangePct: number;
  instrumentsUp: number;
  instrumentsDown: number;
  bestSymbol: string;
  bestChange: number;
}

export interface SessionAnalysisResult {
  sessions: SessionStats[];
  currentSession: SessionStats;
  bestSession: SessionStats;
  summary: string;
}

const SESSION_DEFS = [
  { name: "Sydney", startUTC: 22, endUTC: 7, vol: 0.6 },
  { name: "Tokyo", startUTC: 0, endUTC: 8, vol: 0.8 },
  { name: "London", startUTC: 8, endUTC: 13, vol: 1.3 },
  { name: "London-NY Overlap", startUTC: 13, endUTC: 17, vol: 1.65 },
  { name: "New York", startUTC: 17, endUTC: 22, vol: 1.2 },
];

function isActive(startUTC: number, endUTC: number, hour: number): boolean {
  if (startUTC < endUTC) {
    return hour >= startUTC && hour < endUTC;
  }
  // wraps midnight
  return hour >= startUTC || hour < endUTC;
}

export async function analyzeSessions(): Promise<SessionAnalysisResult> {
  const { quotes, session: current } = await getAllQuotes();
  const hourUTC = new Date().getUTCHours();
  const quoteList = Object.values(quotes);

  const sessions: SessionStats[] = [];

  for (const def of SESSION_DEFS) {
    const active = isActive(def.startUTC, def.endUTC, hourUTC);
    // Sample a few instruments to estimate session behavior
    const sampleSyms = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD"];
    let volSum = 0;
    let rangeSum = 0;
    let count = 0;
    const changes: number[] = [];
    for (const sym of sampleSyms) {
      const { candles } = await getCandles(sym, "h1", 24);
      if (candles.length < 14) continue;
      const atrArr = atr(candles, 14);
      const atrVal = lastValid(atrArr);
      const price = candles[candles.length - 1].close;
      volSum += atrVal;
      rangeSum += (atrVal / price) * 100;
      count++;
      const q = quotes[sym];
      if (q) changes.push(q.changePct);
    }
    const avgVolume = count > 0 ? volSum / count : 0;
    const rangePct = count > 0 ? rangeSum / count : 0;
    const volatility = Math.min(100, rangePct * 40 * def.vol);

    const up = quoteList.filter((q) => q.changePct > 0).length;
    const down = quoteList.filter((q) => q.changePct < 0).length;
    const trend: SessionStats["trend"] =
      up > down * 1.3 ? "Bullish" : down > up * 1.3 ? "Bearish" : "Mixed";

    const liquidity: SessionStats["liquidity"] =
      def.vol > 1.4 ? "Deep" : def.vol > 0.9 ? "Normal" : "Thin";

    const sorted = [...quoteList].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    const bestSymbol = sorted[0]?.symbol || "—";
    const bestChange = sorted[0]?.changePct || 0;

    sessions.push({
      name: def.name,
      active,
      volMultiplier: def.vol,
      trend,
      avgVolume,
      volatility: Math.round(volatility),
      liquidity,
      rangePct: Math.round(rangePct * 100) / 100,
      instrumentsUp: up,
      instrumentsDown: down,
      bestSymbol,
      bestChange,
    });
  }

  const currentSession = sessions.find((s) => s.active) || sessions[0];
  const bestSession = [...sessions].sort((a, b) => b.volatility - a.volatility)[0];

  const summary = `Current session: ${currentSession.name} (vol ×${currentSession.volMultiplier}). Most active: ${bestSession.name}. Market ${currentSession.instrumentsUp} up / ${currentSession.instrumentsDown} down.`;

  return { sessions, currentSession, bestSession, summary };
}
