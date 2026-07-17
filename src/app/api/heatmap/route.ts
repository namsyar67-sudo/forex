import { NextResponse } from "next/server";
import { computeHeatmap } from "@/lib/heatmap/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const heatmap = await computeHeatmap();
  return NextResponse.json(heatmap);
}
