import { NextResponse } from "next/server";
import { generateNews } from "@/lib/market/news";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const news = await generateNews();
  return NextResponse.json({ news, time: Date.now() });
}
