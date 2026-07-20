/**
 * AI Decision Engine — Single AI Call (No Timeout)
 * Gathers all data (computation only), then ONE GLM-5.2 call for everything.
 * Total: ~15-20s (computation 3s + AI 15s)
 */
import { yepChat } from "./yepapi-client";

// Use Gemini 2.5 Flash for everything — it's fast (5s) vs GLM-5.2 (30s+)
const MODEL = "google/gemini-2.5-flash";
import { analyzePair } from "@/lib/market/analysis";
import { getCandles } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzePriceAction } from "@/lib/price-action/engine";

export interface AIDecision {
  symbol: string;
  decision: "BUY" | "SELL" | "WAIT" | "HOLD";
  confidence: number;
  direction: "long" | "short" | "neutral";
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  timeframe: string;
  reasoning: string;
  newsAnalysis: string;
  marketAnalysis: string;
  liquidityAnalysis: string;
  chartAnalysis: string;
  keyFactors: string[];
  riskWarnings: string[];
  newsSourcesRead: { title: string; source: string; sentiment: string }[];
  overallSentiment: string;
  sentimentScore: number;
  marketStatus?: string;
  marketStatusReason?: string;
  pipelineSteps: { step: string; status: "done" | "skipped" | "failed"; duration: number }[];
  timestamp: number;
}

export function getMarketStatus(symbol: string): { status: "open" | "closed" | "weekend" | "holiday"; reason: string } {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  if (symbol.includes("BTC") || symbol.includes("ETH")) return { status: "open", reason: "Crypto 24/7." };
  if (day === 6) return { status: "weekend", reason: "Saturday — closed." };
  if (day === 0 && hour < 22) return { status: "weekend", reason: "Sunday — closed until 22:00 UTC." };
  if (day === 5 && hour >= 22) return { status: "closed", reason: "Friday night — closed." };
  return { status: "open", reason: "Markets open." };
}

export async function getAIDecision(symbol: string): Promise<AIDecision | null> {
  const sym = symbol.toUpperCase();
  const marketStatus = getMarketStatus(sym);
  const pipelineSteps: AIDecision["pipelineSteps"] = [];

  // ─── STEP 1: Gather ALL market data (computation only, ~3s) ───
  const step1Start = Date.now();
  const [analysis, candlesResult] = await Promise.all([analyzePair(sym), getCandles(sym, "h1", 80)]);
  if (!analysis) return null;
  const { candles } = candlesResult;

  const smc = candles.length >= 30 ? analyzeSmartMoney(sym, "h1", candles) : null;
  const pa = candles.length >= 10 ? analyzePriceAction(sym, "h1", candles) : null;

  pipelineSteps.push({ step: "1. Market Data", status: "done", duration: Date.now() - step1Start });

  // Market closed → WAIT (no AI call)
  if (marketStatus.status !== "open") {
    pipelineSteps.push({ step: "2. AI Decision", status: "skipped", duration: 0 });
    return buildResult(sym, "WAIT", 90, "neutral", analysis, smc, pa, marketStatus, pipelineSteps,
      `Market ${marketStatus.status}. ${marketStatus.reason} No trading when closed.`,
      "No news — market closed.", `${analysis.trend} trend, RSI ${analysis.rsi}.`,
      `${analysis.session}. ${analysis.liquidity}.`, smc ? `SMC: ${smc.summary.bias}` : "N/A",
      [`Market ${marketStatus.status}`], ["Do not trade when closed"], 0, 0, 0, 0, 0, 0,
      [], "neutral", 0);
  }

  // ─── STEP 2: ONE AI call (GLM-5.2) — does everything ───
  const step2Start = Date.now();
  const a = analysis;
  const pd = smc?.premiumDiscount?.position ?? 0.5;
  const pdL = pd < 0.35 ? "DISCOUNT" : pd > 0.65 ? "PREMIUM" : "EQUILIBRIUM";

  const prompt = `You are a Chief AI Trading Analyst. Analyze ${sym} and decide.

Based on your knowledge of current market events and the technical data below:

TECHNICAL (H1):
- Trend: ${a.trend} (ADX ${a.adx}) | RSI: ${a.rsi} | MACD: ${a.macdHist > 0 ? "Bullish" : "Bearish"}
- ATR: ${a.atr} (${a.atrPct}%) | Signal: ${a.signal} (${a.signalScore}/100)
- EMA20: ${a.ema20} | EMA50: ${a.ema50} | EMA200: ${a.ema200}
- Support: ${a.support} | Resistance: ${a.resistance}
- Volatility: ${a.volatility} | Risk: ${a.riskScore}/100

SMART MONEY:
${smc ? `- Bias: ${smc.summary.bias} (${(smc.summary.biasStrength * 100).toFixed(0)}%)
- Structure: ${smc.summary.marketStructure} | OBs: ${smc.summary.activeOrderBlocks} | FVGs: ${smc.summary.activeFVGs}
- Sweeps: ${smc.summary.liquiditySwept} | Zone: ${pdL}
- BOS: ${smc.summary.lastBOS?.type || "none"} | CHOCH: ${smc.summary.lastCHOCH?.direction || "none"}
${pa ? `- Patterns: ${pa.patternCount} (${pa.netBias}). ${pa.latestPattern ? "Latest: " + pa.latestPattern.type.replace(/_/g, " ") : ""}` : ""}` : "N/A"}

LIQUIDITY: ${a.session} | ${a.liquidity} | ${a.volatility} | ${a.spreadPips} pips
Price: ${a.price}

Based on your knowledge of recent news AND the technical data above, respond JSON:
{"decision":"BUY|SELL|WAIT|HOLD","confidence":0-100,"direction":"long|short|neutral","reasoning":"4-6 sentences with timeframe mention (H1 primary)","newsAnalysis":"what recent news affects this pair","marketAnalysis":"technical summary","liquidityAnalysis":"liquidity summary","chartAnalysis":"SMC summary","keyFactors":["f1","f2","f3","f4","f5"],"riskWarnings":["w1","w2"],"newsSentiment":"bullish|bearish|neutral","newsScore":-100 to 100,"newsItems":[{"title":"...","sentiment":"bullish|bearish|neutral"}]}`;

  try {
    const raw = await yepChat([
      { role: "assistant", content: "You are a Chief AI Trading Analyst. Respond in JSON only." },
      { role: "user", content: prompt },
    ], MODEL, 12000);

    pipelineSteps.push({ step: "2. AI Decision (Gemini 2.5 Flash)", status: "done", duration: Date.now() - step2Start });

    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]);
      const atr = a.atr || a.price * 0.005;
      const isLong = p.direction === "long";
      const entry = a.price;
      const sl = isLong ? entry - atr*1.5 : entry + atr*1.5;
      const tp1 = isLong ? entry + atr*1.5 : entry - atr*1.5;
      const tp2 = isLong ? entry + atr*3 : entry - atr*3;
      const tp3 = isLong ? entry + atr*5 : entry - atr*5;
      const rr = Math.abs(tp3-entry)/Math.abs(entry-sl);
      const newsItems = p.newsItems || [];

      return buildResult(sym, p.decision || "WAIT", p.confidence || 50, p.direction || "neutral",
        a, smc, pa, marketStatus, pipelineSteps,
        p.reasoning || "", p.newsAnalysis || "", p.marketAnalysis || "",
        p.liquidityAnalysis || "", p.chartAnalysis || "",
        p.keyFactors || [], p.riskWarnings || [`Risk ${a.riskScore}/100`],
        entry, sl, tp1, tp2, tp3, Math.round(rr*10)/10,
        newsItems.map((n: any) => ({ title: n.title || "", source: "AI", sentiment: n.sentiment || "neutral" })),
        p.newsSentiment || "neutral", p.newsScore || 0);
    }
  } catch (err: any) {
    pipelineSteps.push({ step: "2. AI Decision", status: "failed", duration: Date.now() - step2Start });
  }

  // Quant fallback
  let bull = 0, bear = 0;
  if (a.trend === "Bullish") bull += 25; else if (a.trend === "Bearish") bear += 25;
  if (a.rsi < 35) bull += 15; else if (a.rsi > 65) bear += 15;
  if (a.macdHist > 0) bull += 12; else bear += 12;
  if (a.signalScore > 0) bull += a.signalScore * 0.3; else bear += Math.abs(a.signalScore) * 0.3;
  if (smc?.summary.bias === "bullish") bull += smc.summary.biasStrength * 20;
  else if (smc?.summary.bias === "bearish") bear += smc.summary.biasStrength * 20;
  const isLong = bull > bear;
  const dom = Math.max(bull, bear);
  const dec = dom > 30 ? (isLong ? "BUY" : "SELL") : "WAIT";
  const conf = Math.min(100, Math.round(dom + 20));
  const atr = a.atr || a.price * 0.005;
  const entry = a.price;
  const sl = isLong ? entry - atr*1.5 : entry + atr*1.5;
  const tp1 = isLong ? entry + atr*1.5 : entry - atr*1.5;
  const tp2 = isLong ? entry + atr*3 : entry - atr*3;
  const tp3 = isLong ? entry + atr*5 : entry - atr*5;
  const rr = Math.abs(tp3-entry)/Math.abs(entry-sl);
  return buildResult(sym, dec, conf, isLong ? "long" : "short",
    a, smc, pa, marketStatus, pipelineSteps,
    `AI failed. Quant: ${a.trend}, RSI ${a.rsi}, SMC ${smc?.summary.bias||"neutral"}. Bull: ${bull.toFixed(0)}, Bear: ${bear.toFixed(0)}.`,
    "AI unavailable.", `${a.trend} (ADX ${a.adx}), RSI ${a.rsi}.`,
    `${a.session}. ${a.liquidity}.`, smc ? `SMC: ${smc.summary.bias}.` : "N/A",
    [`${a.trend} trend`, `RSI ${a.rsi}`, `SMC ${smc?.summary.bias||"neutral"}`],
    [`Risk ${a.riskScore}/100`, "AI failed"], entry, sl, tp1, tp2, tp3, Math.round(rr*10)/10,
    [], "neutral", 0);
}

function buildResult(sym: string, decision: string, confidence: number, direction: string,
  a: any, smc: any, pa: any, marketStatus: any, pipelineSteps: any[],
  reasoning: string, newsAnalysis: string, marketAnalysis: string, liquidityAnalysis: string, chartAnalysis: string,
  keyFactors: string[], riskWarnings: string[],
  entry: number, sl: number, tp1: number, tp2: number, tp3: number, rr: number,
  newsSourcesRead: any[], overallSentiment: string, sentimentScore: number
): AIDecision {
  return {
    symbol: sym, decision: decision as any, confidence, direction: direction as any,
    entryPrice: entry, stopLoss: sl, takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3,
    riskReward: rr, timeframe: "H1 (Primary) + M15 + H4 + D1",
    reasoning, newsAnalysis, marketAnalysis, liquidityAnalysis, chartAnalysis,
    keyFactors, riskWarnings, newsSourcesRead,
    overallSentiment, sentimentScore,
    marketStatus: marketStatus.status, marketStatusReason: marketStatus.reason,
    pipelineSteps, timestamp: Date.now(),
  };
}
