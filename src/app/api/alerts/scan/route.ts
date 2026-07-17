import { NextResponse } from "next/server";
import { runAlertMonitor } from "@/lib/alerts/monitor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Trigger an alert scan (called periodically by the dashboard)
export async function POST() {
  const detections = await runAlertMonitor();
  return NextResponse.json({ detections, count: detections.length, time: Date.now() });
}
