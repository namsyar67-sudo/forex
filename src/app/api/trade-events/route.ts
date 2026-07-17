import { NextResponse } from "next/server";
import { monitorActiveSignals } from "@/lib/trade-monitor/monitor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST: trigger trade monitoring for active signals
export async function POST() {
  try {
    await monitorActiveSignals();
    return NextResponse.json({ success: true, time: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
