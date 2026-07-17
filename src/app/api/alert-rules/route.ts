import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Default alert rules seeded once
const DEFAULT_RULES = [
  { type: "bos", label: "Break of Structure detected", severity: "info" },
  { type: "choch", label: "Change of Character detected", severity: "warning" },
  { type: "fvg", label: "Fair Value Gap formed", severity: "info" },
  { type: "order_block", label: "Order Block tapped", severity: "info" },
  { type: "level_proximity", label: "Price near key level", severity: "warning" },
  { type: "news", label: "High-impact news approaching", severity: "warning" },
  { type: "risk", label: "Risk score elevated", severity: "warning" },
  { type: "confidence", label: "Confidence changed significantly", severity: "info" },
  { type: "trend", label: "Trend reversed", severity: "critical" },
];

export async function GET() {
  let rules = await db.alertRule.findMany({ orderBy: { type: "asc" } });
  if (rules.length === 0) {
    for (const r of DEFAULT_RULES) {
      await db.alertRule.create({
        data: {
          type: r.type,
          enabled: true,
          params: JSON.stringify({ severity: r.severity, label: r.label }),
        },
      });
    }
    rules = await db.alertRule.findMany({ orderBy: { type: "asc" } });
  }
  return NextResponse.json({
    rules: rules.map((r) => ({ ...r, params: JSON.parse(r.params) })),
  });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, enabled, params } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const updated = await db.alertRule.update({
    where: { id },
    data: {
      ...(enabled !== undefined ? { enabled } : {}),
      ...(params ? { params: JSON.stringify(params) } : {}),
    },
  });
  return NextResponse.json({ rule: updated });
}
