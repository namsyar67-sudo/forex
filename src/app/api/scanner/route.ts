import { NextResponse } from "next/server";
import { runMarketScan } from "@/lib/scanner/engine";
import { getOrCompute } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST: trigger a market scan
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const minConfidence = parseInt(searchParams.get("minConfidence") || "65", 10);
  const minQualityScore = parseInt(searchParams.get("minQualityScore") || "55", 10);

  try {
    const result = await runMarketScan({ minConfidence, minQualityScore, persistSignals: true });
    return NextResponse.json({
      totalScanned: result.results.length,
      topOpportunities: result.topOpportunities.length,
      newSignals: result.newSignals.length,
      top: result.results.slice(0, 10).map(r => ({
        rank: r.rank,
        symbol: r.signal.symbol,
        signalType: r.signal.signalType,
        direction: r.signal.direction,
        confidence: r.signal.confidence,
        qualityScore: r.signal.qualityScore,
        reasons: r.signal.reasons.slice(0, 3),
      })),
      timestamp: result.timestamp,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: fetch latest scan results from DB
export async function GET() {
  const results = await getOrCompute(
    "scanner:latest",
    30000,
    async () => {
      const db = (await import("@/lib/db")).db;
      const rows = await db.scanResult.findMany({
        orderBy: { rank: "asc" },
        take: 16,
      });
      return rows;
    }
  );
  return NextResponse.json({ results, time: Date.now() });
}
