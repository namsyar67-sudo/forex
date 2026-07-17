import { NextResponse } from "next/server";
import { chatWithContext, type ChatMessage } from "@/lib/ai/ai-service";
import { analyzeAll, buildAnalysisSummary } from "@/lib/market/analysis";
import { getAllQuotes } from "@/lib/market/client";

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

  const reply = await chatWithContext(messages, { marketOverview, topMovers, analysisDigest });
  return NextResponse.json({ reply, time: Date.now() });
}
