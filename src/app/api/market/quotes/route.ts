import { NextResponse } from "next/server";
import { getAllQuotes } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { quotes, session } = await getAllQuotes();
  return NextResponse.json({ quotes, session, time: Date.now() });
}
