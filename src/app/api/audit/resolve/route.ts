import { NextResponse } from "next/server";
import { autoResolveAudits } from "@/lib/audit/service";

export const dynamic = "force-dynamic";

// POST: trigger auto-resolution of old audits
export async function POST() {
  const resolved = await autoResolveAudits();
  return NextResponse.json({ resolved, time: Date.now() });
}
