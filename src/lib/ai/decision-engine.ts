/**
 * AI Decision Engine — YepAPI Powered
 * Uses Gemini 3.5 Flash for news + GLM-5.2 for decisions
 * Sequential pipeline with key rotation
 */
import { yepChat, yepNewsChat, yepDecisionChat, yepWebSearch, isYepAPIConfigured } from "./yepapi-client";
import { analyzePair } from "@/lib/market/analysis";
import { getCandles } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzeMultiTimeframe } from "@/lib/multi-timeframe/engine";
import { analyzePriceAction } from "@/lib/price-action/engine";

const WAIT_BETWEEN_STEPS = 3000;
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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

// Step 1: Collect news via YepAPI (Gemini 3.5 Flash)
async function step1_CollectNews(symbol: string, category: string) {
  const start = Date.now();
  const name = symbol === "XAUUSD" ? "Gold" : symbol === "BTCUSD" ? "Bitcoin" :
    symbol === "ETHUSD" ? "Ethereum" : symbol === "NAS100" ? "Nasdaq" :
    symbol === "US30" ? "Dow Jones" : symbol === "SPX500" ? "S&P 500" : symbol;

  const results = await Promise.all([
    yepWebSearch(`${name} price news today`, 5),
    yepWebSearch(category === "forex" ? "USD forex news today" : `${name} market analysis`, 4),
  ]);

  const all = [...results[0], ...results[1]].filter(Boolean);
  const seen = new Set<string>();
  const items = all.filter((r: any) => {
    const key = (r.title || r.name || "").toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12).map((r: any) => ({
    title: r.title || r.name || "",
    snippet: (r.snippet || "").substring(0, 120),
    source: r.source || r.host_name || "web",
    url: r.url || "",
  }));

  return { items, duration: Date.now() - start };
}

// Step 2: Analyze news (Gemini 3.5 Flash)
async function step2_AnalyzeNews(news: any[], symbol: string) {
  const start = Date.now();
  if (news.length === 0) return {
    sentiment: "neutral", score: 0, bullish: 0, bearish: 0, neutral: 0,
    analysis: "No news available.", itemAnalysis: [], duration: Date.now() - start,
  };

  const newsText = news.map((n, i) => `${i+1}. ${n.title} (${n.source})\n   ${n.snippet}`).join("\n");
  try {
    const raw = await yepNewsChat([
      { role: "assistant", content: "You are a financial news analyst. Output JSON only." },
      { role: "user", content: `Analyze these ${news.length} news items for ${symbol}:\n${newsText}\n\nRespond JSON:\n{"items":[{"title":"...","sentiment":"bullish|bearish|neutral","impact":"high|medium|low","summary":"1 line"}],"overall":"bullish|bearish|neutral","score":-100 to 100,"bullishCount":N,"bearishCount":N,"summary":"2-3 sentences"}` },
    ], 15000);

    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]);
      const items = p.items || [];
      return {
        sentiment: p.overall || "neutral", score: p.score || 0,
        bullish: p.bullishCount || 0, bearish: p.bearishCount || 0,
        neutral: items.length - (p.bullishCount || 0) - (p.bearishCount || 0),
        analysis: p.summary || "Analysis incomplete.",
        itemAnalysis: items.map((it: any) => ({ title: it.title, sentiment: it.sentiment || "neutral", impact: it.impact || "low", summary: it.summary || "" })),
        duration: Date.now() - start,
      };
    }
  } catch {}

  // Heuristic fallback
  const bull = ["surge","rally","gain","rise","bullish","upgrade","beat","strong","positive","up"];
  const bear = ["drop","fall","decline","bearish","downgrade","miss","weak","negative","down","crash","sell"];
  let b = 0, r2 = 0;
  const itemAnalysis = news.map(n => {
    const t = `${n.title} ${n.snippet}`.toLowerCase();
    let s = 0; bull.forEach(w => { if (t.includes(w)) s++; });
    bear.forEach(w => { if (t.includes(w)) s--; });
    const sent = s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral";
    if (sent === "bullish") b++; else if (sent === "bearish") r2++;
    return { title: n.title, sentiment: sent, impact: "medium", summary: n.snippet.substring(0, 60) };
  });
  const score = (b - r2) * (100 / Math.max(news.length, 1));
  return {
    sentiment: score > 0 ? "bullish" : score < 0 ? "bearish" : "neutral",
    score: Math.max(-100, Math.min(100, score)),
    bullish: b, bearish: r2, neutral: news.length - b - r2,
    analysis: `Heuristic: ${b} bullish, ${r2} bearish, ${news.length - b - r2} neutral.`,
    itemAnalysis, duration: Date.now() - start,
  };
}

// Step 3: Chart analysis (computation only)
async function step3_AnalyzeChart(symbol: string) {
  const start = Date.now();
  const [analysis, candlesResult] = await Promise.all([analyzePair(symbol), getCandles(symbol, "h1", 100)]);
  if (!analysis) return null;
  const { candles } = candlesResult;
  const [smc, pa] = await Promise.all([
    candles.length >= 30 ? analyzeSmartMoney(symbol, "h1", candles) : null,
    candles.length >= 10 ? analyzePriceAction(symbol, "h1", candles) : null,
  ]);
  return { analysis, smc, pa, duration: Date.now() - start };
}

// Step 4: Liquidity + MTF
async function step4_AnalyzeLiquidity(symbol: string, analysis: any) {
  const start = Date.now();
  const mtf = await analyzeMultiTimeframe(symbol).catch(() => null);
  return {
    mtf,
    liquidity: { session: analysis.session, liquidity: analysis.liquidity, volatility: analysis.volatility, spreadPips: analysis.spreadPips },
    duration: Date.now() - start,
  };
}

// Step 5: Chief Decision (GLM-5.2)
async function step5_ChiefDecision(symbol: string, news: any[], na: any, chart: any, liq: any) {
  const start = Date.now();
  const a = chart.analysis; const smc = chart.smc; const pa = chart.pa; const mtf = liq.mtf; const l = liq.liquidity;
  const pd = smc?.premiumDiscount?.position ?? 0.5;
  const pdL = pd < 0.35 ? "DISCOUNT" : pd > 0.65 ? "PREMIUM" : "EQUILIBRIUM";
  const newsD = na.itemAnalysis.length > 0 ? na.itemAnalysis.slice(0, 8).map((n: any, i: number) => `[${i+1}] ${n.sentiment.toUpperCase()} (${n.impact}) — ${n.title}`).join("\n") : "No news.";

  const prompt = `You are the Chief AI Analyst. 4 teams analyzed ${symbol}. Make the FINAL decision.

=== NEWS ===
Overall: ${na.sentiment} (score: ${na.score}/100)
Bullish: ${na.bullish} | Bearish: ${na.bearish} | Neutral: ${na.neutral}
${na.analysis}
${newsD}

=== TECHNICAL (H1) ===
Trend: ${a.trend} (ADX ${a.adx}) | RSI: ${a.rsi} | MACD: ${a.macdHist > 0 ? "Bullish" : "Bearish"}
Signal: ${a.signal} (${a.signalScore}/100)
EMA20: ${a.ema20} | EMA50: ${a.ema50} | EMA200: ${a.ema200}
Support: ${a.support} | Resistance: ${a.resistance}

=== SMART MONEY ===
${smc ? `Bias: ${smc.summary.bias} (${(smc.summary.biasStrength * 100).toFixed(0)}%)
Structure: ${smc.summary.marketStructure} | OBs: ${smc.summary.activeOrderBlocks} | FVGs: ${smc.summary.activeFVGs}
Sweeps: ${smc.summary.liquiditySwept} | Zone: ${pdL}
BOS: ${smc.summary.lastBOS?.type || "none"} | CHOCH: ${smc.summary.lastCHOCH?.direction || "none"}
${pa ? `PA: ${pa.patternCount} patterns, ${pa.netBias}. ${pa.latestPattern ? "Latest: " + pa.latestPattern.type.replace(/_/g," ") : ""}` : ""}` : "N/A"}

=== LIQUIDITY & MTF ===
Session: ${l.session} | ${l.liquidity} | ${l.volatility} | ${l.spreadPips} pips
${mtf ? `MTF: ${mtf.overall.alignment}% (${mtf.overall.trendBias}) — ${mtf.overall.decision}` : "N/A"}

Price: ${a.price}

Respond JSON:
{"decision":"BUY|SELL|WAIT|HOLD","confidence":0-100,"direction":"long|short|neutral","reasoning":"4-6 sentences","keyFactors":["f1","f2","f3","f4","f5"],"riskWarnings":["w1","w2"]}`;

  try {
    const raw = await yepDecisionChat([
      { role: "assistant", content: "You are a Chief AI Trading Analyst. Review all reports and decide. JSON only." },
      { role: "user", content: prompt },
    ], 20000);

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
      return { ...p, entry, sl, tp1, tp2, tp3, rr: Math.round(rr*10)/10, duration: Date.now()-start };
    }
  } catch {}
  return null;
}

export async function getAIDecision(symbol: string): Promise<AIDecision | null> {
  const sym = symbol.toUpperCase();
  const marketStatus = getMarketStatus(sym);
  const category = sym.includes("XAU") || sym.includes("XAG") ? "metals" : sym.includes("BTC") || sym.includes("ETH") ? "crypto" : sym.includes("USD") && !sym.startsWith("X") ? "forex" : "indices";
  const pipelineSteps: AIDecision["pipelineSteps"] = [];

  // Step 1: News
  const s1 = await step1_CollectNews(sym, category);
  pipelineSteps.push({ step: "1. News Collection", status: s1.items.length > 0 ? "done" : "failed", duration: s1.duration });
  await sleep(WAIT_BETWEEN_STEPS);

  // Step 2: News Analysis
  const s2 = await step2_AnalyzeNews(s1.items, sym);
  pipelineSteps.push({ step: "2. News Analysis", status: "done", duration: s2.duration });
  await sleep(WAIT_BETWEEN_STEPS);

  // Step 3: Chart
  const s3 = await step3_AnalyzeChart(sym);
  if (!s3) return null;
  pipelineSteps.push({ step: "3. Chart Analysis", status: "done", duration: s3.duration });

  // Step 4: Liquidity
  const s4 = await step4_AnalyzeLiquidity(sym, s3.analysis);
  pipelineSteps.push({ step: "4. Liquidity & MTF", status: "done", duration: s4.duration });
  await sleep(WAIT_BETWEEN_STEPS);

  // Market closed → WAIT
  if (marketStatus.status !== "open") {
    pipelineSteps.push({ step: "5. Chief Decision", status: "skipped", duration: 0 });
    return buildResult(sym, "WAIT", 90, "neutral", s3, s4, s2, s1.items, marketStatus, pipelineSteps,
      `Market ${marketStatus.status}. ${marketStatus.reason} No trading when closed.`,
      s2.analysis, `${s3.analysis.trend} trend, RSI ${s3.analysis.rsi}.`,
      `${s4.liquidity.session}. ${s4.liquidity.liquidity}.`, s3.smc ? `SMC: ${s3.smc.summary.bias}` : "N/A",
      [`Market ${marketStatus.status}`, `${s1.items.length} news`, s2.sentiment], ["Do not trade when closed"], 0, 0, 0, 0, 0, 0);
  }

  // Step 5: Chief Decision
  const chief = await step5_ChiefDecision(sym, s1.items, s2, s3, s4);
  const a = s3.analysis; const smc = s3.smc; const pa = s3.pa; const mtf = s4.mtf; const liq = s4.liquidity; const na = s2;
  const pd = smc?.premiumDiscount?.position ?? 0.5;
  const pdL = pd < 0.35 ? "DISCOUNT (buy zone)" : pd > 0.65 ? "PREMIUM (sell zone)" : "EQUILIBRIUM";

  if (chief) {
    pipelineSteps.push({ step: "5. Chief Decision", status: "done", duration: chief.duration });
    return buildResult(sym, chief.decision, chief.confidence, chief.direction, s3, s4, s2, s1.items, marketStatus, pipelineSteps,
      chief.reasoning, na.analysis,
      `${a.trend} (ADX ${a.adx}), RSI ${a.rsi}, MACD ${a.macdHist > 0 ? "bullish" : "bearish"}. Signal: ${a.signal} (${a.signalScore}/100). EMA: ${a.ema20}/${a.ema50}/${a.ema200}. S/R: ${a.support}/${a.resistance}.`,
      `${liq.session}. ${liq.liquidity}, ${liq.volatility}. ${liq.spreadPips} pips. ${mtf ? `MTF: ${mtf.overall.alignment}% (${mtf.overall.trendBias}).` : ""}`,
      smc ? `SMC: ${smc.summary.bias} (${(smc.summary.biasStrength*100).toFixed(0)}%). ${smc.summary.activeOrderBlocks} OBs, ${smc.summary.activeFVGs} FVGs, ${smc.summary.liquiditySwept} sweeps. ${pdL}. BOS: ${smc.summary.lastBOS?.type||"none"}. CHOCH: ${smc.summary.lastCHOCH?.direction||"none"}. ${pa ? `PA: ${pa.patternCount} patterns, ${pa.netBias}.` : ""}` : "N/A",
      chief.keyFactors || [], chief.riskWarnings || [`Risk ${a.riskScore}/100`],
      chief.entry, chief.sl, chief.tp1, chief.tp2, chief.tp3, chief.rr);
  }

  // Quant fallback
  pipelineSteps.push({ step: "5. Chief Decision", status: "failed", duration: 0 });
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

  return buildResult(sym, dec, conf, isLong ? "long" : "short", s3, s4, s2, s1.items, marketStatus, pipelineSteps,
    `Chief AI failed. Quant: ${a.trend}, RSI ${a.rsi}, SMC ${smc?.summary.bias||"neutral"}, news ${na.sentiment}. Bull: ${bull.toFixed(0)}, Bear: ${bear.toFixed(0)}.`,
    na.analysis, `${a.trend} (ADX ${a.adx}), RSI ${a.rsi}, MACD ${a.macdHist > 0 ? "bullish" : "bearish"}.`,
    `${a.session}. ${a.liquidity}.`, smc ? `SMC: ${smc.summary.bias}.` : "N/A",
    [`${a.trend} trend`, `RSI ${a.rsi}`, `SMC ${smc?.summary.bias||"neutral"}`, `News ${na.sentiment}`],
    [`Risk ${a.riskScore}/100`, "Chief AI failed — quant fallback"], entry, sl, tp1, tp2, tp3, Math.round(rr*10)/10);
}

function buildResult(sym: string, decision: string, confidence: number, direction: string,
  chart: any, liq: any, na: any, news: any[], marketStatus: any, pipelineSteps: any[],
  reasoning: string, newsAnalysis: string, marketAnalysis: string, liquidityAnalysis: string, chartAnalysis: string,
  keyFactors: string[], riskWarnings: string[], entry?: number, sl?: number, tp1?: number, tp2?: number, tp3?: number, rr?: number
): AIDecision {
  const a = chart.analysis;
  const atr = a.atr || a.price * 0.005;
  const isLong = direction === "long";
  const e = entry || a.price;
  const s = sl || (isLong ? e - atr*1.5 : e + atr*1.5);
  const t1 = tp1 || (isLong ? e + atr*1.5 : e - atr*1.5);
  const t2 = tp2 || (isLong ? e + atr*3 : e - atr*3);
  const t3 = tp3 || (isLong ? e + atr*5 : e - atr*5);
  const r = rr || Math.abs(t3-e)/Math.abs(e-s);
  return {
    symbol: sym, decision: decision as any, confidence, direction: direction as any,
    entryPrice: e, stopLoss: s, takeProfit1: t1, takeProfit2: t2, takeProfit3: t3,
    riskReward: Math.round(r*10)/10, timeframe: "H1 (Primary) + M15 + H4 + D1",
    reasoning, newsAnalysis, marketAnalysis, liquidityAnalysis, chartAnalysis,
    keyFactors, riskWarnings,
    newsSourcesRead: (na.itemAnalysis || []).map((n: any) => ({ title: n.title, source: "", sentiment: n.sentiment })),
    overallSentiment: na.sentiment || "neutral", sentimentScore: na.score || 0,
    marketStatus: marketStatus.status, marketStatusReason: marketStatus.reason,
    pipelineSteps, timestamp: Date.now(),
  };
}
