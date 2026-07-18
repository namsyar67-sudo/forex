import { NextResponse } from "next/server";
import { getLatencyStatsFromMemory, getLatencyStatsFromDB } from "@/lib/audit/latency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hoursBack = parseInt(searchParams.get("hours") || "24", 10);
  const source = searchParams.get("source") || "memory";

  if (source === "db") {
    const stats = await getLatencyStatsFromDB(hoursBack);
    return NextResponse.json({ stats, source: "db", hoursBack, time: Date.now() });
  }

  const stats = getLatencyStatsFromMemory();
  return NextResponse.json({ stats, source: "memory", time: Date.now() });
}
