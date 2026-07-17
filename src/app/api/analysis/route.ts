import { NextResponse } from "next/server";
import { analyzeAll, buildAnalysisSummary } from "@/lib/market/analysis";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const all = await analyzeAll();
  const summaries = all.map((a) => buildAnalysisSummary(a));

  // Persist top decisions (only high-confidence, dedupe by symbol within 10 min)
  try {
    for (const s of summaries) {
      if (s.confidence >= 65 && (s.action === "buy" || s.action === "sell")) {
        const recent = await db.decision.findFirst({
          where: { symbol: s.symbol, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
          orderBy: { createdAt: "desc" },
        });
        if (!recent) {
          const a = all.find((x) => x.symbol === s.symbol);
          const pair = await db.pair.findUnique({ where: { symbol: s.symbol } });
          if (pair && a) {
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
  } catch (e) {
    // non-fatal
  }

  return NextResponse.json({ analysis: all, summaries, time: Date.now() });
}
