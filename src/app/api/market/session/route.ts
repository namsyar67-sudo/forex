import { NextResponse } from "next/server";
import { getSession } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session, time: Date.now() });
}
