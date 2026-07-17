import { NextResponse } from "next/server";
import { chatWithContext, type ChatMessage } from "@/lib/ai/ai-service";
import { analyzeAll, buildAnalysisSummary } from "@/lib/market/analysis";
import { getAllQuotes, getCandles } from "@/lib/market/client";
import { analyzeSmartMoney } from "@/lib/smart-money/engine";
import { analyzeMultiTimeframe } from "@/lib/multi-timeframe/engine";
import { computeProbabilities } from "@/lib/probability/engine";
import { computeNewsImpact } from "@/lib/news-impact/engine";
import { computeHeatmap } from "@/lib/heatmap/engine";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages = body.messages || [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Detect if the user is asking about a specific symbol
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const symbolPattern = /\b(EURUSD|GBPUSD|USDJPY|USDCHF|AUDUSD|NZDUSD|USDCAD|XAUUSD|XAGUSD|BTCUSD|ETHUSD|NAS100|US30|SPX500|GER40|UK100)\b/i;
  const symbolMatch = lastUserMsg.match(symbolPattern);
  const focusSymbol = symbolMatch ? symbolMatch[1].toUpperCase() : null;

  // Build live context from real data
  const all = await analyzeAll();
  const { quotes, session } = await getAllQuotes();

  const marketOverview = `Session: ${session.name} (vol multiplier ${session.vol}). ${quotes.length} instruments live. Market ${quotes.filter(q => q.changePct > 0).length} up / ${quotes.filter(q => q.changePct < 0).length} down.`;

  const topMovers = [...quotes]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 5)
    .map(q => `${q.symbol}: ${q.last} (${q.changePct > 0 ? "+" : ""}${q.changePct.toFixed(2)}%)`)
    .join("\n");

  const analysisDigest = all
    .map(a => {
      const s = buildAnalysisSummary(a);
      return `${a.symbol} [${a.category}]: ${s.action.toUpperCase()} conf=${s.confidence}% risk=${s.riskScore} | ${a.trend} RSI=${a.rsi} ADX=${a.adx} ATR%=${a.atrPct} | signal=${a.signal}`;
    })
    .join("\n");

  // Smart Money context (focus symbol if mentioned, else top movers)
  const smcSymbols = focusSymbol ? [focusSymbol] : [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 4).map(q => q.symbol);
  const smcLines: string[] = [];
  for (const sym of smcSymbols) {
    try {
      const { candles } = await getCandles(sym, "h1", 300);
      if (candles.length < 30) continue;
      const smc = analyzeSmartMoney(sym, "h1", candles);
      smcLines.push(
        `${sym} SMC: bias=${smc.summary.bias} strength=${(smc.summary.biasStrength * 100).toFixed(0)}% structure=${smc.summary.marketStructure} | lastBOS=${smc.summary.lastBOS?.type || "none"}(${smc.summary.lastBOS?.direction || "-"}) | activeOBs=${smc.summary.activeOrderBlocks} activeFVGs=${smc.summary.activeFVGs} sweeps=${smc.summary.liquiditySwept} | premiumDiscount=${(smc.premiumDiscount.position * 100).toFixed(0)}% (${smc.premiumDiscount.position < 0.35 ? "discount" : smc.premiumDiscount.position > 0.65 ? "premium" : "equilibrium"})`
      );
    } catch {
      // skip
    }
  }

  // MTF context for focus symbol
  let mtfContext = "";
  if (focusSymbol) {
    try {
      const mtf = await analyzeMultiTimeframe(focusSymbol);
      mtfContext = `\n${focusSymbol} MTF: alignment=${mtf.overall.alignment}% trendBias=${mtf.overall.trendBias} decision=${mtf.overall.decision} confidence=${mtf.overall.confidence}%\nTF breakdown: ${mtf.timeframes.map(t => `${t.timeframe}=${t.signal}(${t.confidence}%)`).join(" ")}`;
    } catch {
      // skip
    }
  }

  // Probability for focus symbol
  let probContext = "";
  if (focusSymbol) {
    const a = all.find((x) => x.symbol === focusSymbol);
    if (a) {
      try {
        const { candles } = await getCandles(focusSymbol, "h1", 300);
        const smc = candles.length >= 30 ? analyzeSmartMoney(focusSymbol, "h1", candles) : undefined;
        const mtf = await analyzeMultiTimeframe(focusSymbol);
        const prob = computeProbabilities(focusSymbol, a, smc, mtf);
        probContext = `\n${focusSymbol} PROBABILITY: Buy=${prob.buy}% Sell=${prob.sell}% Wait=${prob.wait}% (dominant: ${prob.dominant})`;
      } catch {
        // skip
      }
    }
  }

  // News impact
  let newsContext = "";
  try {
    const news = await computeNewsImpact();
    newsContext = `\nNEWS: ${news.highImpactCount} high-impact items. Top risk: ${news.topRiskSymbols.slice(0, 4).map(s => `${s.symbol}(${s.risk})`).join(", ")}`;
  } catch {
    // skip
  }

  // Heatmap
  let heatmapContext = "";
  try {
    const hm = await computeHeatmap();
    heatmapContext = `\nHEATMAP: Strong=${hm.topCurrency?.currency}(${hm.topCurrency?.strength}) Weak=${hm.bottomCurrency?.currency}(${hm.bottomCurrency?.strength})`;
  } catch {
    // skip
  }

  // V3 Active signals context
  let signalsContext = "";
  try {
    const activeSignals = await db.activeSignal.findMany({
      where: { status: { in: ["active", "tp1_hit", "tp2_hit"] } },
      orderBy: { qualityScore: "desc" },
      take: 5,
    });
    if (activeSignals.length > 0) {
      signalsContext = `\nACTIVE SIGNALS (${activeSignals.length}):\n` + activeSignals.map(s =>
        `${s.symbol} ${s.direction.toUpperCase()} ${s.signalType} | entry=${s.entryPrice} conf=${s.confidence}% quality=${s.qualityScore}/100 | SL=${s.stopLoss} TP1=${s.takeProfit1} TP2=${s.takeProfit2} TP3=${s.takeProfit3} | status=${s.status} | reasons=${(JSON.parse(s.reasons || "[]")).slice(0, 3).join(",")}`
      ).join("\n");
    } else {
      signalsContext = "\nACTIVE SIGNALS: None currently active.";
    }

    // Recent notifications
    const recentEvents = await db.tradeEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (recentEvents.length > 0) {
      signalsContext += `\nRECENT EVENTS:\n` + recentEvents.map(e =>
        `${e.type} | ${e.symbol} | ${e.title} | ${e.priority}`
      ).join("\n");
    }
  } catch {
    // skip
  }

  const fullContext = `LIVE TERMINAL CONTEXT:
${marketOverview}

TOP MOVERS:
${topMovers}

ANALYSIS DIGEST (per instrument):
${analysisDigest}

SMART MONEY CONTEXT:
${smcLines.join("\n")}
${mtfContext}${probContext}${newsContext}${heatmapContext}${signalsContext}`;

  const reply = await chatWithContext(messages, {
    marketOverview: fullContext,
    topMovers,
    analysisDigest,
  });
  return NextResponse.json({ reply, focusSymbol, time: Date.now() });
}
