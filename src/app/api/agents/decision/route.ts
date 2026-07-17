import { NextResponse } from "next/server";
import { runChiefDecision, runChiefDecisionAll } from "@/lib/agents/chief";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: run Chief AI Agent decision for a symbol, or all symbols
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const all = searchParams.get("all") === "true";

  try {
    if (all) {
      const result = await runChiefDecisionAll();
      return NextResponse.json({
        decisions: result.decisions.map(d => ({
          symbol: d.symbol,
          recommendation: d.finalRecommendation,
          confidence: d.unifiedConfidence,
          qualityScore: d.qualityScore,
          direction: d.direction,
          consensus: d.consensus,
          summary: d.reasoning.split("\n")[0],
        })),
        topPicks: result.topPicks,
        count: result.decisions.length,
        time: Date.now(),
      });
    }

    if (!symbol) {
      return NextResponse.json({ error: "Provide ?symbol=EURUSD or ?all=true" }, { status: 400 });
    }

    const decision = await runChiefDecision(symbol.toUpperCase());
    return NextResponse.json({ decision, time: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
