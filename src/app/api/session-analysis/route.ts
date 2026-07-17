import { NextResponse } from "next/server";
import { analyzeSessions } from "@/lib/session-analysis/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await analyzeSessions();
  return NextResponse.json(result);
}
