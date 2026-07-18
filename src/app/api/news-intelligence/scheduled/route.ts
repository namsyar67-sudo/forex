import { NextResponse } from "next/server";
import { generateCalendar } from "@/lib/market/news";
import { processCalendarEvents, generateScheduledAlerts } from "@/lib/news-intelligence/agents";
import { getOrCompute } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const calendar = await getOrCompute("calendar:events", 300000, () => generateCalendar(2));
  const processed = processCalendarEvents(calendar);
  const upcoming = processed.filter(e => e.isUpcoming && e.impact === "high");
  const alerts = generateScheduledAlerts(processed);

  return NextResponse.json({
    events: processed,
    upcomingHigh: upcoming,
    scheduledAlerts: alerts,
    time: Date.now(),
  });
}
