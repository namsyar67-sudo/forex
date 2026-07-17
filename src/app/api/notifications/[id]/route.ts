import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updated = await db.tradeEvent.update({
    where: { id },
    data: { read: true },
  });
  return NextResponse.json({ event: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.tradeEvent.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
