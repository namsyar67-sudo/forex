import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_INSTRUMENTS } from "@/lib/market/instruments";

export const dynamic = "force-dynamic";

export async function POST() {
  let created = 0;
  let updated = 0;
  for (const inst of DEFAULT_INSTRUMENTS) {
    const existing = await db.pair.findUnique({ where: { symbol: inst.symbol } });
    if (existing) {
      await db.pair.update({
        where: { symbol: inst.symbol },
        data: {
          name: inst.name,
          category: inst.category,
          basePrice: inst.basePrice,
          digits: inst.digits,
          pipSize: inst.pipSize,
          lotSize: inst.lotSize,
        },
      });
      updated++;
    } else {
      await db.pair.create({
        data: {
          symbol: inst.symbol,
          name: inst.name,
          category: inst.category,
          basePrice: inst.basePrice,
          digits: inst.digits,
          pipSize: inst.pipSize,
          lotSize: inst.lotSize,
        },
      });
      created++;
    }
  }

  // Seed a welcome alert if none exist
  const alertCount = await db.alert.count();
  if (alertCount === 0) {
    await db.alert.create({
      data: {
        type: "system",
        severity: "info",
        title: "Terminal initialized",
        message: `${DEFAULT_INSTRUMENTS.length} instruments loaded. Live market stream active. AI analysis standing by.`,
      },
    });
  }

  return NextResponse.json({ success: true, created, updated, total: DEFAULT_INSTRUMENTS.length });
}
