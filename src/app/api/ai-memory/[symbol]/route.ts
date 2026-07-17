import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzePair, buildAnalysisSummary } from "@/lib/market/analysis";
import { getAllQuotes } from "@/lib/market/client";
import ZAI from "z-ai-web-dev-sdk";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: fetch memory stats for a symbol (last 100 predictions, accuracy)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  // Resolve outstanding predictions (older than 1h, not yet resolved)
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const outstanding = await db.aIMemoryEntry.findMany({
    where: { symbol: sym, resolvedAt: null, createdAt: { lt: cutoff } },
    take: 20,
  });
  const { quotes } = await getAllQuotes();
  for (const entry of outstanding) {
    const q = quotes[sym];
    if (!q) continue;
    const priceChange = q.last - entry.priceAtPrediction;
    const actualOutcome: "up" | "down" | "flat" =
      Math.abs(priceChange) < entry.priceAtPrediction * 0.0005 ? "flat" : priceChange > 0 ? "up" : "down";
    const predictedDir = entry.predictedDirection;
    const correct =
      (predictedDir === "bullish" && actualOutcome === "up") ||
      (predictedDir === "bearish" && actualOutcome === "down") ||
      (predictedDir === "neutral" && actualOutcome === "flat");
    const accuracyScore = correct ? Math.min(100, entry.predictedConfidence + 10) : Math.max(0, 100 - entry.predictedConfidence);
    await db.aIMemoryEntry.update({
      where: { id: entry.id },
      data: {
        priceAtOutcome: q.last,
        actualOutcome,
        correct,
        accuracyScore,
        resolvedAt: new Date(),
      },
    });
  }

  // Fetch last 100 resolved predictions
  const entries = await db.aIMemoryEntry.findMany({
    where: { symbol: sym, resolvedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const total = entries.length;
  const correct = entries.filter((e) => e.correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Analyze success vs failure factors via AI (lightweight)
  let insights = { successFactors: [] as string[], failureFactors: [] as string[] };
  if (total >= 4) {
    try {
      const zai = await ZAI.create();
      const correctSample = entries.filter((e) => e.correct).slice(0, 5).map((e) => e.analysis).join("\n");
      const wrongSample = entries.filter((e) => !e.correct).slice(0, 5).map((e) => e.analysis).join("\n");
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: "You are an AI trading performance analyst. Given JSON snapshots of correct and incorrect predictions, identify the top success factors and failure factors. Respond in JSON: {\"successFactors\":[...],\"failureFactors\":[...]}. Be concise." },
          { role: "user", content: `Correct predictions context:\n${correctSample}\n\nIncorrect predictions context:\n${wrongSample}` },
        ],
        thinking: { type: "disabled" },
      });
      const raw = completion.choices[0]?.message?.content || "{}";
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) insights = JSON.parse(m[0]);
    } catch {
      // ignore
    }
  }

  // Trend of accuracy over time (buckets of 10)
  const trend: { bucket: number; accuracy: number }[] = [];
  const reversed = [...entries].reverse();
  for (let i = 0; i < reversed.length; i += 10) {
    const bucket = reversed.slice(i, i + 10);
    const c = bucket.filter((e) => e.correct).length;
    trend.push({ bucket: Math.floor(i / 10) + 1, accuracy: bucket.length > 0 ? Math.round((c / bucket.length) * 100) : 0 });
  }

  return NextResponse.json({
    symbol: sym,
    total,
    correct,
    accuracy,
    insights,
    trend,
    recent: entries.slice(0, 10),
    time: Date.now(),
  });
}

// POST: record a new prediction
export async function POST(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const analysis = await analyzePair(sym);
  if (!analysis) {
    return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
  }
  const summary = buildAnalysisSummary(analysis);
  const { quotes } = await getAllQuotes();
  const q = quotes[sym];
  if (!q) {
    return NextResponse.json({ error: "No live quote" }, { status: 400 });
  }
  const predictedDirection =
    summary.action === "buy" ? "bullish" : summary.action === "sell" ? "bearish" : "neutral";

  const entry = await db.aIMemoryEntry.create({
    data: {
      symbol: sym,
      predictedAction: summary.action,
      predictedConfidence: summary.confidence,
      predictedDirection,
      actualOutcome: "",
      priceAtPrediction: q.last,
      priceAtOutcome: 0,
      correct: false,
      accuracyScore: 0,
      analysis: JSON.stringify({ rsi: analysis.rsi, trend: analysis.trend, signal: analysis.signal, signalScore: analysis.signalScore, riskScore: summary.riskScore }),
      learnedFactors: body.note || null,
    },
  });
  return NextResponse.json({ entry, predictedAction: summary.action, confidence: summary.confidence });
}
