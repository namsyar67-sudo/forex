/**
 * AI Decision Engine
 * The AI reads REAL news from the web, analyzes the market, liquidity, chart,
 * and news — then makes the final trading decision.
 *
 * This is the PRIMARY decision-maker (not just an interpreter).
 * The quant analysis feeds data TO the AI; the AI decides.
 */
import ZAI from "z-ai-web-dev-sdk";
import { getAllQuotes, getCandles } from "@/lib/market/client";
import { analyzePair, buildAnalysisSummary } from "@/lib/market/analysis";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzeMultiTimeframe } from "@/lib/multi-timeframe/engine";
import { getOrCompute } from "@/lib/cache";

declare global {
  var __zaiDecision: any | undefined;
}

async function getAI() {
  if (!global.__zaiDecision) {
    try {
      global.__zaiDecision = await ZAI.create();
    } catch {
      const config = {
        baseUrl: process.env.ZAI_BASE_URL || "https://internal-api.z.ai/v1",
        apiKey: process.env.ZAI_API_KEY || "Z.ai",
        token: process.env.ZAI_TOKEN || "",
        chatId: process.env.ZAI_CHAT_ID || "",
        userId: process.env.ZAI_USER_ID || "",
      };
      global.__zaiDecision = new (ZAI as any)(config);
    }
  }
  return global.__zaiDecision;
}

// ---------- Step 1: Search the web for REAL news ----------
export interface RealNewsItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date: string;
}

export async function searchRealNews(symbol: string, category: string): Promise<RealNewsItem[]> {
  const zai = await getAI();

  // Build search queries based on symbol category
  const queries = buildNewsQueries(symbol, category);
  const allResults: RealNewsItem[] = [];

  for (const query of queries.slice(0, 2)) {
    try {
      const results = await zai.functions.invoke("web_search", {
        query,
        num: 5,
        recency_days: 1,
      });

      if (Array.isArray(results)) {
        for (const r of results) {
          allResults.push({
            title: r.name || "",
            snippet: r.snippet || "",
            url: r.url || "",
            source: r.host_name || "",
            date: r.date || "",
          });
        }
      }
    } catch {
      // skip failed searches
    }
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return allResults.filter((item) => {
    const key = item.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function buildNewsQueries(symbol: string, category: string): string[] {
  const queries: string[] = [];
  const baseName = symbol.replace("USD", "").replace("EUR", "").replace("GBP", "");

  if (category === "forex") {
    queries.push(`${symbol} forex news today`);
    queries.push(`${baseName} USD trading analysis today`);
  } else if (category === "metals") {
    queries.push(`${symbol === "XAUUSD" ? "Gold" : "Silver"} price news today`);
    queries.push(`${symbol === "XAUUSD" ? "Gold" : "Silver"} market analysis`);
  } else if (category === "crypto") {
    queries.push(`${baseName} crypto news today`);
    queries.push(`${baseName} price prediction analysis`);
  } else if (category === "indices") {
    const name = symbol === "NAS100" ? "Nasdaq" : symbol === "US30" ? "Dow Jones" : symbol === "SPX500" ? "S&P 500" : symbol === "GER40" ? "DAX" : "FTSE";
    queries.push(`${name} index news today`);
    queries.push(`${name} market analysis`);
  }

  // Add macro news
  queries.push("USD dollar news today forex");
  queries.push("Federal Reserve interest rate news");

  return queries;
}

// ---------- Step 2: Gather all market data ----------
export interface MarketDataSnapshot {
  symbol: string;
  price: number;
  changePct: number;
  digits: number;
  // Technical indicators
  rsi: number;
  adx: number;
  macdHist: number;
  atr: number;
  atrPct: number;
  trend: string;
  signal: string;
  signalScore: number;
  ema20: number;
  ema50: number;
  ema200: number;
  bbUpper: number;
  bbLower: number;
  support: number;
  resistance: number;
  // Smart Money
  smcBias: string;
  smcStructure: string;
  smcBiasStrength: number;
  activeOrderBlocks: number;
  activeFVGs: number;
  liquiditySwept: number;
  premiumDiscount: string;
  // Multi-timeframe
  mtfAlignment: number;
  mtfDecision: string;
  mtfTrendBias: string;
  // Session & liquidity
  session: string;
  liquidity: string;
  volatility: string;
  riskScore: number;
  spreadPips: number;
}

export async function gatherMarketData(symbol: string): Promise<MarketDataSnapshot | null> {
  const analysis = await getOrCompute(`analysis:${symbol}`, 10000, () => analyzePair(symbol));
  if (!analysis) return null;

  let smc: any = null;
  let mtf: any = null;
  try {
    const { candles } = await getCandles(symbol, "h1", 120);
    if (candles.length >= 30) {
      smc = analyzeSmartMoney(symbol, "h1", candles);
    }
    mtf = await getOrCompute(`mtf:${symbol}`, 30000, () => analyzeMultiTimeframe(symbol));
  } catch { /* skip */ }

  const pd = smc?.premiumDiscount?.position ?? 0.5;
  const pdLabel = pd < 0.35 ? "DISCOUNT (buy zone)" : pd > 0.65 ? "PREMIUM (sell zone)" : "EQUILIBRIUM";

  return {
    symbol: analysis.symbol,
    price: analysis.price,
    changePct: analysis.changePct,
    digits: analysis.quote.digits,
    rsi: analysis.rsi,
    adx: analysis.adx,
    macdHist: analysis.macdHist,
    atr: analysis.atr,
    atrPct: analysis.atrPct,
    trend: analysis.trend,
    signal: analysis.signal,
    signalScore: analysis.signalScore,
    ema20: analysis.ema20,
    ema50: analysis.ema50,
    ema200: analysis.ema200,
    bbUpper: analysis.bbUpper,
    bbLower: analysis.bbLower,
    support: analysis.support,
    resistance: analysis.resistance,
    smcBias: smc?.summary?.bias ?? "neutral",
    smcStructure: smc?.summary?.marketStructure ?? "unknown",
    smcBiasStrength: smc?.summary?.biasStrength ?? 0,
    activeOrderBlocks: smc?.summary?.activeOrderBlocks ?? 0,
    activeFVGs: smc?.summary?.activeFVGs ?? 0,
    liquiditySwept: smc?.summary?.liquiditySwept ?? 0,
    premiumDiscount: pdLabel,
    mtfAlignment: mtf?.overall?.alignment ?? 0,
    mtfDecision: mtf?.overall?.decision ?? "unknown",
    mtfTrendBias: mtf?.overall?.trendBias ?? "neutral",
    session: analysis.session,
    liquidity: analysis.liquidity,
    volatility: analysis.volatility,
    riskScore: analysis.riskScore,
    spreadPips: analysis.spreadPips,
  };
}

// ---------- Step 3: AI makes the decision ----------
export interface AIDecision {
  symbol: string;
  decision: "BUY" | "SELL" | "WAIT" | "HOLD";
  confidence: number; // 0..100
  direction: "long" | "short" | "neutral";
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  // AI's reasoning
  reasoning: string;
  newsAnalysis: string;
  marketAnalysis: string;
  liquidityAnalysis: string;
  chartAnalysis: string;
  keyFactors: string[];
  riskWarnings: string[];
  // What news the AI read
  newsSourcesRead: { title: string; source: string; url: string }[];
  // Timestamps
  timestamp: number;
}

export async function getAIDecision(symbol: string): Promise<AIDecision | null> {
  const sym = symbol.toUpperCase();

  // Step 1: Search for REAL news
  const inst = (await getCandles(sym, "h1", 5));
  const category = sym.includes("XAU") || sym.includes("XAG") ? "metals" :
                   sym.includes("BTC") || sym.includes("ETH") ? "crypto" :
                   sym.includes("USD") && !sym.startsWith("X") ? "forex" : "indices";

  const news = await getOrCompute(`realnews:${sym}`, 60000, () => searchRealNews(sym, category));

  // Step 2: Gather all market data
  const marketData = await gatherMarketData(sym);
  if (!marketData) return null;

  // Step 3: Ask the AI to make the decision
  const zai = await getAI();

  const systemPrompt = `You are a professional AI Trading Analyst. You make the FINAL trading decision based on ALL available data.

Your job:
1. READ the real news from the web (provided below).
2. ANALYZE the chart (technical indicators, EMA, RSI, MACD, Bollinger).
3. ANALYZE the Smart Money structure (BOS, CHOCH, Order Blocks, FVG, liquidity).
4. ANALYZE the liquidity and session conditions.
5. ANALYZE the multi-timeframe alignment.
6. Make a FINAL DECISION: BUY, SELL, WAIT, or HOLD.

CRITICAL RULES:
- Do NOT rely on a single news item or single indicator. Consider EVERYTHING.
- If data conflicts or is incomplete, return WAIT with explanation.
- If there is high-impact news approaching, return WAIT.
- The decision must be based on the CONFLUENCE of multiple factors.
- Always provide clear entry, stop loss, and 3 take profit levels.
- Risk management is mandatory — never suggest a trade with RR worse than 1:2.

Respond in valid JSON only:
{
  "decision": "BUY|SELL|WAIT|HOLD",
  "confidence": 0-100,
  "direction": "long|short|neutral",
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit1": number,
  "takeProfit2": number,
  "takeProfit3": number,
  "reasoning": "3-5 sentence explanation of WHY this decision",
  "newsAnalysis": "what the news says and how it affects this pair",
  "marketAnalysis": "technical analysis summary",
  "liquidityAnalysis": "liquidity and session analysis",
  "chartAnalysis": "chart structure analysis (SMC, patterns)",
  "keyFactors": ["factor1", "factor2", ...],
  "riskWarnings": ["warning1", ...]
}`;

  const newsText = news.length > 0
    ? news.map((n, i) => `[${i + 1}] ${n.title}\n    Source: ${n.source}\n    ${n.snippet}`).join("\n\n")
    : "No recent news found.";

  const userPrompt = `=== REAL NEWS (searched from the web) ===
${newsText}

=== MARKET DATA for ${sym} ===
Price: ${marketData.price}
Change: ${marketData.changePct}%
Session: ${marketData.session} (${marketData.liquidity} liquidity)
Volatility: ${marketData.volatility}
Spread: ${marketData.spreadPips} pips
Risk Score: ${marketData.riskScore}/100

=== TECHNICAL INDICATORS ===
Trend: ${marketData.trend}
Signal: ${marketData.signal} (score: ${marketData.signalScore}/100)
RSI(14): ${marketData.rsi}
ADX: ${marketData.adx}
MACD Histogram: ${marketData.macdHist}
ATR: ${marketData.atr} (${marketData.atrPct}%)
EMA20: ${marketData.ema20}
EMA50: ${marketData.ema50}
EMA200: ${marketData.ema200}
Bollinger Upper: ${marketData.bbUpper}
Bollinger Lower: ${marketData.bbLower}
Support: ${marketData.support}
Resistance: ${marketData.resistance}

=== SMART MONEY / ICT ===
SMC Bias: ${marketData.smcBias} (strength: ${(marketData.smcBiasStrength * 100).toFixed(0)}%)
Market Structure: ${marketData.smcStructure}
Active Order Blocks: ${marketData.activeOrderBlocks}
Active FVGs: ${marketData.activeFVGs}
Liquidity Swept: ${marketData.liquiditySwept} zones
Premium/Discount: ${marketData.premiumDiscount}

=== MULTI-TIMEFRAME ===
MTF Alignment: ${marketData.mtfAlignment}%
MTF Decision: ${marketData.mtfDecision}
MTF Trend Bias: ${marketData.mtfTrendBias}

Now make your decision based on ALL of the above.`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const atr = marketData.atr || marketData.price * 0.005;
        const isLong = parsed.direction === "long";
        const entry = parsed.entryPrice || marketData.price;
        const slDist = atr * 1.5;
        const stopLoss = parsed.stopLoss || (isLong ? entry - slDist : entry + slDist);
        const tp1 = parsed.takeProfit1 || (isLong ? entry + atr * 1.5 : entry - atr * 1.5);
        const tp2 = parsed.takeProfit2 || (isLong ? entry + atr * 3 : entry - atr * 3);
        const tp3 = parsed.takeProfit3 || (isLong ? entry + atr * 5 : entry - atr * 5);
        const rr = Math.abs(tp3 - entry) / Math.abs(entry - stopLoss);

        return {
          symbol: sym,
          decision: parsed.decision || "WAIT",
          confidence: parsed.confidence || 50,
          direction: parsed.direction || "neutral",
          entryPrice: entry,
          stopLoss,
          takeProfit1: tp1,
          takeProfit2: tp2,
          takeProfit3: tp3,
          riskReward: Math.round(rr * 10) / 10,
          reasoning: parsed.reasoning || "",
          newsAnalysis: parsed.newsAnalysis || "",
          marketAnalysis: parsed.marketAnalysis || "",
          liquidityAnalysis: parsed.liquidityAnalysis || "",
          chartAnalysis: parsed.chartAnalysis || "",
          keyFactors: parsed.keyFactors || [],
          riskWarnings: parsed.riskWarnings || [],
          newsSourcesRead: news.map((n) => ({ title: n.title, source: n.source, url: n.url })),
          timestamp: Date.now(),
        };
      } catch {
        // JSON parse failed
      }
    }

    // Fallback: use quant decision if AI fails
    return fallbackDecision(marketData, news);
  } catch (err: any) {
    return fallbackDecision(marketData, news, err.message);
  }
}

function fallbackDecision(marketData: MarketDataSnapshot, news: RealNewsItem[], errorMsg?: string): AIDecision {
  const isLong = marketData.signalScore > 0;
  const atr = marketData.atr || marketData.price * 0.005;
  const entry = marketData.price;
  const slDist = atr * 1.5;
  const stopLoss = isLong ? entry - slDist : entry + slDist;
  const tp1 = isLong ? entry + atr * 1.5 : entry - atr * 1.5;
  const tp2 = isLong ? entry + atr * 3 : entry - atr * 3;
  const tp3 = isLong ? entry + atr * 5 : entry - atr * 5;
  const rr = Math.abs(tp3 - entry) / Math.abs(entry - stopLoss);

  return {
    symbol: marketData.symbol,
    decision: marketData.signalScore > 20 ? (isLong ? "BUY" : "SELL") : "WAIT",
    confidence: Math.min(100, Math.abs(marketData.signalScore) + 20),
    direction: isLong ? "long" : "short",
    entryPrice: entry,
    stopLoss,
    takeProfit1: tp1,
    takeProfit2: tp2,
    takeProfit3: tp3,
    riskReward: Math.round(rr * 10) / 10,
    reasoning: `AI decision engine unavailable${errorMsg ? ` (${errorMsg})` : ""}. Falling back to quant analysis. ${marketData.trend} trend, RSI ${marketData.rsi}, signal ${marketData.signal}.`,
    newsAnalysis: `${news.length} news items were searched. AI analysis unavailable — review manually.`,
    marketAnalysis: `${marketData.trend} trend, ADX ${marketData.adx}, RSI ${marketData.rsi}.`,
    liquidityAnalysis: `${marketData.liquidity} liquidity in ${marketData.session} session.`,
    chartAnalysis: `SMC bias: ${marketData.smcBias}. ${marketData.activeOrderBlocks} OBs, ${marketData.activeFVGs} FVGs.`,
    keyFactors: [`${marketData.trend} trend`, `RSI ${marketData.rsi}`, `SMC ${marketData.smcBias}`],
    riskWarnings: [`Risk score ${marketData.riskScore}/100`],
    newsSourcesRead: news.map((n) => ({ title: n.title, source: n.source, url: n.url })),
    timestamp: Date.now(),
  };
}
