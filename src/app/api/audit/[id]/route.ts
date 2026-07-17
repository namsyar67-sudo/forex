import { NextResponse } from "next/server";
import { getAuditDetail, resolveDecisionAudit } from "@/lib/audit/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = await getAuditDetail(id);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }
  return NextResponse.json({ audit, time: Date.now() });
}

// PATCH: manually resolve an audit
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await resolveDecisionAudit({
    auditId: id,
    finalOutcome: body.finalOutcome || "expired",
    outcomePrice: body.outcomePrice,
    outcomePnl: body.outcomePnl,
    outcomeReason: body.outcomeReason,
    confidenceChange: body.confidenceChange,
  });

  return NextResponse.json({ success: true });
}
