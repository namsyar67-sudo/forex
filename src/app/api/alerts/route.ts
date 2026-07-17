import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const alerts = await db.alert.findMany({
    where: unreadOnly ? { read: false } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ alerts, time: Date.now() });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { type, symbol, severity, title, message } = body;
  if (!title || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const alert = await db.alert.create({
    data: {
      type: type || "system",
      symbol: symbol || null,
      severity: severity || "info",
      title,
      message,
    },
  });
  return NextResponse.json({ alert });
}
