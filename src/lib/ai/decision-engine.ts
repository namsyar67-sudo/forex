/**
 * AI Decision Engine — YepAPI Powered (Optimized)
 * Gemini 3.5 Flash for news + GLM-5.2 for decision
 * 2 AI calls only, no delays, parallel computation
 */
import { yepChat, yepDecisionChat, isYepAPIConfigured } from "./yepapi-client";
import { analyzePair } from "@/lib/market/analysis";
import { getCandles } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzeMultiTimeframe } from "@/lib/multi-timeframe/engine";
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
  const category = sym.includes("XAU") || sym.includes("XAG") ? "metals" :
    sym.includes("BTC") || sym.includes("ETH") ? "crypto" :
    sym.includes("USD") && !sym.startsWith("X") ? "forex" : "indices";
  const pipelineSteps: AIDecision["pipelineSteps"] = [];
  const name = sym === "XAUUSD" ? "Gold" : sym === "BTCUSD" ? "Bitcoin" :
    sym === "ETHUSD" ? "Ethereum" : sym === "NAS100" ? "Nasdaq" : sym;

  // ─── PARALLEL: News (AI call #1) + Market Analysis (computation) ───
  const newsStart = Date.now();
  const marketStart = Date.now();

  const [newsResult, marketResult] = await Promise.all([
    // AI Call #1: Gemini 3.5 Flash — collect news AND analyze sentiment in ONE call
    yepChat([
      { role: "assistant", content: "You are a financial news analyst. Output JSON only." },
      { role: "user", content: `Find 5 recent news about "${name}" and "${category}". Classify each as bullish/bearish/neutral for ${sym}.

JSON: {"items":[{"title":"...","source":"...","sentiment":"bullish|bearish|neutral","impact":"high|medium|low","summary":"..."}],"overall":"bullish|bearish|neutral","score":-100 to 100,"bullishCount":N,"bearishCount":N,"summary":"2 sentences"}` },
    ], "google/gemini-3.5-flash", 12000).catch(() => null),

    // Computation: chart + liquidity + MTF (no AI)
    (async () => {
      const [analysis, candlesResult] = await Promise.all([analyzePair(sym), getCandles(sym, "h1", 100)]);
      if (!analysis) return null;
      const { candles } = candlesResult;
      const [smc, pa, mtf] = await Promise.all([
        candles.length >= 30 ? analyzeSmartMoney(sym, "h1", candles) : null,
        candles.length >= 10 ? analyzePriceAction(sym, "h1", candles) : null,
        null, // Skip MTF on Vercel (too slow) — use trend from analysis instead
      ]);
      return { analysis, smc, pa, mtf, duration: Date.now() - marketStart };
    })(),
  ]);

  pipelineSteps.push({
    step: "1. News + Market Analysis (parallel)",
    status: newsResult ? "done" : "failed",
    duration: Date.now() - newsStart,
  });

  if (!marketResult) return null;

  // Parse news analysis
  let na = {
    sentiment: "neutral", score: 0, bullish: 0, bearish: 0, neutral: 0,
    analysis: "No news available.", itemAnalysis: [] as any[],
  };
  if (newsResult) {
    const match = newsResult.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const p = JSON.parse(match[0]);
        const items = p.items || [];
        na = {
          sentiment: p.overall || "neutral",
          score: p.score || 0,
          bullish: p.bullishCount || 0,
          bearish: p.bearishCount || 0,
          neutral: items.length - (p.bullishCount || 0) - (p.bearishCount || 0),
          analysis: p.summary || "Analysis incomplete.",
          itemAnalysis: items,
        };
      } catch {}
    }
  }

  const a = marketResult.analysis;
  const smc = marketResult.smc;
  const pa = marketResult.pa;
  const mtf = marketResult.mtf;
  const liq = { session: a.session, liquidity: a.liquidity, volatility: a.volatility, spreadPips: a.spreadPips };
  const pd = smc?.premiumDiscount?.position ?? 0.5;
  const pdL = pd < 0.35 ? "DISCOUNT (buy zone)" : pd > 0.65 ? "PREMIUM (sell zone)" : "EQUILIBRIUM";

  // Market closed → WAIT (no second AI call needed)
  if (marketStatus.status !== "open") {
    pipelineSteps.push({ step: "2. Chief Decision", status: "skipped", duration: 0 });
    return buildResult(sym, "WAIT", 90, "neutral", a, smc, pa, mtf, liq, na, marketStatus, pipelineSteps,
      `Market ${marketStatus.status}. ${marketStatus.reason} No trading when closed.`,
      na.analysis, `${a.trend} trend, RSI ${a.rsi}.`,
      `${liq.session}. ${liq.liquidity}.`, smc ? `SMC: ${smc.summary.bias}` : "N/A",
      [`Market ${marketStatus.status}`, `${na.itemAnalysis.length} news`, na.sentiment],
      ["Do not trade when closed"], 0, 0, 0, 0, 0, 0);
  }

  // ─── AI Call #2: GLM-5.2 — Chief Decision ───
  const chiefStart = Date.now();
  const newsDetail = na.itemAnalysis.length > 0
    ? na.itemAnalysis.slice(0, 8).map((n: any, i: number) => `[${i+1}] ${n.sentiment?.toUpperCase() || "NEUTRAL"} — ${n.title}`).join("\n")
    : "No news analyzed.";

  const prompt = `You are the Chief AI Analyst. 4 teams analyzed ${sym}. Make the FINAL decision.

=== NEWS ANALYSIS (Gemini 3.5 Flash) ===
Overall: ${na.sentiment} (score: ${na.score}/100)
Bullish: ${na.bullish} | Bearish: ${na.bearish} | Neutral: ${na.neutral}
Summary: ${na.analysis}
${newsDetail}

=== TECHNICAL (H1) ===
Trend: ${a.trend} (ADX ${a.adx}) | RSI: ${a.rsi} | MACD: ${a.macdHist > 0 ? "Bullish" : "Bearish"}
ATR: ${a.atr} (${a.atrPct}%) | Signal: ${a.signal} (${a.signalScore}/100)
EMA20: ${a.ema20} | EMA50: ${a.ema50} | EMA200: ${a.ema200}
Support: ${a.support} | Resistance: ${a.resistance}

=== SMART MONEY ===
${smc ? `Bias: ${smc.summary.bias} (${(smc.summary.biasStrength * 100).toFixed(0)}%)
Structure: ${smc.summary.marketStructure} | OBs: ${smc.summary.activeOrderBlocks} | FVGs: ${smc.summary.activeFVGs}
Sweeps: ${smc.summary.liquiditySwept} | Zone: ${pdL}
BOS: ${smc.summary.lastBOS?.type || "none"} (${smc.summary.lastBOS?.direction || "-"})
CHOCH: ${smc.summary.lastCHOCH?.direction || "none"}
${pa ? `Price Action: ${pa.patternCount} patterns, ${pa.netBias}. ${pa.latestPattern ? "Latest: " + pa.latestPattern.type.replace(/_/g, " ") : ""}` : ""}` : "N/A"}

=== LIQUIDITY & MTF ===
Session: ${liq.session} | ${liq.liquidity} | ${liq.volatility} | ${liq.spreadPips} pips
${mtf ? `MTF: ${mtf.overall.alignment}% (${mtf.overall.trendBias}) — ${mtf.overall.decision}` : "N/A"}

Price: ${a.price}

Based on ALL teams' reports, make the FINAL decision. Consider confluence.
Primary timeframe: H1. Confirm with M15, H4, D1.

Respond JSON:
{"decision":"BUY|SELL|WAIT|HOLD","confidence":0-100,"direction":"long|short|neutral","reasoning":"4-6 sentences explaining WHY","keyFactors":["f1","f2","f3","f4","f5"],"riskWarnings":["w1","w2"]}`;

  try {
    const raw = await yepDecisionChat([
      { role: "assistant", content: "You are a Chief AI Trading Analyst. Review all reports and decide. JSON only." },
      { role: "user", content: prompt },
    ], 15000);

    pipelineSteps.push({ step: "2. Chief Decision (GLM-5.2)", status: "done", duration: Date.now() - chiefStart });
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
      return buildResult(sym, p.decision || "WAIT", p.confidence || 50, p.direction || "neutral",
        a, smc, pa, mtf, liq, na, marketStatus, pipelineSteps,
        p.reasoning || "", na.analysis,
        `${a.trend} (ADX ${a.adx}), RSI ${a.rsi}, MACD ${a.macdHist > 0 ? "bullish" : "bearish"}. Signal: ${a.signal} (${a.signalScore}/100). EMA: ${a.ema20}/${a.ema50}/${a.ema200}. S/R: ${a.support}/${a.resistance}.`,
        `${liq.session}. ${liq.liquidity}, ${liq.volatility}. ${liq.spreadPips} pips. ${mtf ? `MTF: ${mtf.overall.alignment}% (${mtf.overall.trendBias}).` : ""}`,
        smc ? `SMC: ${smc.summary.bias} (${(smc.summary.biasStrength*100).toFixed(0)}%). ${smc.summary.activeOrderBlocks} OBs, ${smc.summary.activeFVGs} FVGs, ${smc.summary.liquiditySwept} sweeps. ${pdL}. BOS: ${smc.summary.lastBOS?.type||"none"}. CHOCH: ${smc.summary.lastCHOCH?.direction||"none"}. ${pa ? `PA: ${pa.patternCount} patterns, ${pa.netBias}.` : ""}` : "N/A",
        p.keyFactors || [], p.riskWarnings || [`Risk ${a.riskScore}/100`],
        entry, sl, tp1, tp2, tp3, Math.round(rr*10)/10);
    }
  } catch {}

  // Quant fallback
  pipelineSteps.push({ step: "2. Chief Decision", status: "failed", duration: 0 });
  let bull = 0, bear = 0;
  if (a.trend === "Bullish") bull += 25; else if (a.trend === "Bearish") bear += 25;
  if (a.rsi < 35) bull += 15; else if (a.rsi > 65) bear += 15;
  if (a.macdHist > 0) bull += 12; else bear += 12;
  if (a.signalScore > 0) bull += a.signalScore * 0.3; else bear += Math.abs(a.signalScore) * 0.3;
  if (smc?.summary.bias === "bullish") bull += smc.summary.biasStrength * 20;
  else if (smc?.summary.bias === "bearish") bear += smc.summary.biasStrength * 20;
  if (na.score > 0) bull += na.score * 0.15; else if (na.score < 0) bear += Math.abs(na.score) * 0.15;
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
    a, smc, pa, mtf, liq, na, marketStatus, pipelineSteps,
    `Chief AI failed. Quant: ${a.trend}, RSI ${a.rsi}, SMC ${smc?.summary.bias||"neutral"}, news ${na.sentiment}. Bull: ${bull.toFixed(0)}, Bear: ${bear.toFixed(0)}.`,
    na.analysis, `${a.trend} (ADX ${a.adx}), RSI ${a.rsi}, MACD ${a.macdHist > 0 ? "bullish" : "bearish"}.`,
    `${a.session}. ${a.liquidity}.`, smc ? `SMC: ${smc.summary.bias}.` : "N/A",
    [`${a.trend} trend`, `RSI ${a.rsi}`, `SMC ${smc?.summary.bias||"neutral"}`, `News ${na.sentiment}`],
    [`Risk ${a.riskScore}/100`, "Chief AI failed"], entry, sl, tp1, tp2, tp3, Math.round(rr*10)/10);
}

function buildResult(sym: string, decision: string, confidence: number, direction: string,
  a: any, smc: any, pa: any, mtf: any, liq: any, na: any, marketStatus: any, pipelineSteps: any[],
  reasoning: string, newsAnalysis: string, marketAnalysis: string, liquidityAnalysis: string, chartAnalysis: string,
  keyFactors: string[], riskWarnings: string[], entry: number, sl: number, tp1: number, tp2: number, tp3: number, rr: number
): AIDecision {
  return {
    symbol: sym, decision: decision as any, confidence, direction: direction as any,
    entryPrice: entry, stopLoss: sl, takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3,
    riskReward: rr, timeframe: "H1 (Primary) + M15 + H4 + D1",
    reasoning, newsAnalysis, marketAnalysis, liquidityAnalysis, chartAnalysis,
    keyFactors, riskWarnings,
    newsSourcesRead: (na.itemAnalysis || []).map((n: any) => ({ title: n.title || "", source: n.source || "", sentiment: n.sentiment || "neutral" })),
    overallSentiment: na.sentiment || "neutral", sentimentScore: na.score || 0,
    marketStatus: marketStatus.status, marketStatusReason: marketStatus.reason,
    pipelineSteps, timestamp: Date.now(),
  };
}
