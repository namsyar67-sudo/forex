import { NextResponse } from "next/server";
import { listAudits, getAuditStats, autoResolveAudits } from "@/lib/audit/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || undefined;
  const decision = searchParams.get("decision") || undefined;
  const outcome = searchParams.get("outcome") || undefined;
  const unresolvedOnly = searchParams.get("unresolved") === "true";
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const stats = searchParams.get("stats") === "true";

  if (stats) {
    const auditStats = await getAuditStats();
    return NextResponse.json({ stats: auditStats, time: Date.now() });
  }

  const audits = await listAudits({ symbol, decision, outcome, unresolvedOnly, limit });
  return NextResponse.json({ audits, count: audits.length, time: Date.now() });
}

// POST: auto-resolve old audits
export async function POST() {
  const resolved = await autoResolveAudits();
  return NextResponse.json({ resolved, time: Date.now() });
}
