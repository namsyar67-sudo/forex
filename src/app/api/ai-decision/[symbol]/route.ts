import { NextResponse } from "next/server";
import { getAIDecision } from "@/lib/ai/decision-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  try {
    const decision = await getAIDecision(sym);
    if (!decision) {
      return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
    }
    return NextResponse.json({ decision, time: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
