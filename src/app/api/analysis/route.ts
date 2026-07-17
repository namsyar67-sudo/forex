import { NextResponse } from "next/server";
import { getAllAnalysisCached, buildAnalysisSummary } from "@/lib/market/analysis";
import { db } from "@/lib/db";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Use shared cached analysis (also used by scanner)
  const all = await getAllAnalysisCached();
  const summaries = all.map((a) => buildAnalysisSummary(a));
  const lightAnalysis = all.map((a) => {
    const { candles, ...rest } = a;
    return rest;
  });

  // Persist top decisions — only every 60s (rate-limited via cache)
  try {
    const lastPersist = getCached<number>("analysis:lastPersist");
    if (lastPersist === null) {
      setCached("analysis:lastPersist", Date.now(), 60000);
      for (const s of summaries) {
        if (s.confidence >= 65 && (s.action === "buy" || s.action === "sell")) {
          const recent = await db.decision.findFirst({
            where: { symbol: s.symbol, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
            orderBy: { createdAt: "desc" },
          });
          if (!recent) {
            const pair = await db.pair.findUnique({ where: { symbol: s.symbol } });
            if (pair) {
              await db.decision.create({
                data: {
                  pairId: pair.id,
                  symbol: s.symbol,
                  action: s.action,
                  confidence: s.confidence,
                  entryZone: s.entryZone,
                  stopLoss: s.stopLoss,
                  takeProfit: s.takeProfit,
                  riskScore: s.riskScore,
                  trend: s.trend,
                  volatility: s.volatility,
                  session: s.session,
                  summary: s.summary,
                  rationale: s.rationale,
                  indicators: JSON.stringify(s.indicators),
                },
              });
            }
          }
        }
      }
    }
  } catch (e) {
    // non-fatal
  }

  return NextResponse.json({ analysis: lightAnalysis, summaries, time: Date.now() });
}
