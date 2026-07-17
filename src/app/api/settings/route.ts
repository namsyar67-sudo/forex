import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Default terminal settings
const DEFAULT_SETTINGS: Record<string, string> = {
  "ai.provider": "zai",
  "ai.model": "default",
  "ui.theme": "dark",
  "ui.accent": "emerald",
  "ui.refreshInterval": "1000",
  "ui.chartType": "candles",
  "ui.defaultTimeframe": "h1",
  "risk.maxPerTrade": "2",
  "risk.maxDaily": "6",
  "risk.accountBalance": "10000",
  "alerts.enabled": "true",
  "alerts.sound": "false",
  "alerts.minConfidence": "65",
  "news.autoRefresh": "true",
  "terminal.name": "AI Trading Terminal",
};

export async function GET() {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) map[r.id] = r.value;
  return NextResponse.json({ settings: map });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { settings } = body as { settings: Record<string, string> };
  if (!settings) {
    return NextResponse.json({ error: "Missing settings" }, { status: 400 });
  }
  for (const [id, value] of Object.entries(settings)) {
    await db.setting.upsert({
      where: { id },
      create: { id, value: String(value) },
      update: { value: String(value) },
    });
  }
  return NextResponse.json({ success: true });
}
