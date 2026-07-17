import { NextResponse } from "next/server";
import { computeNewsImpact } from "@/lib/news-impact/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await computeNewsImpact();
  return NextResponse.json(result);
}
