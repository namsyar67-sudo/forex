import { NextResponse } from "next/server";
import { correlationMatrix } from "@/lib/market/analysis";
import { getAllInstruments } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const symbols = getAllInstruments().map((i) => i.symbol);
  const matrix = await correlationMatrix(symbols);
  return NextResponse.json({ symbols, matrix, time: Date.now() });
}
