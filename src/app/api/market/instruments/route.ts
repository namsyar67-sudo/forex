import { NextResponse } from "next/server";
import { getAllInstruments } from "@/lib/market/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ instruments: getAllInstruments() });
}
