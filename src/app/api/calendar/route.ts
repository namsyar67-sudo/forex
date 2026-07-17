import { NextResponse } from "next/server";
import { generateCalendar } from "@/lib/market/news";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "2", 10);
  const events = generateCalendar(days);
  return NextResponse.json({ events, time: Date.now() });
}
