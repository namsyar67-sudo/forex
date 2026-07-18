import { NextResponse } from "next/server";
import { ALL_AGENTS } from "@/lib/agents/specialists";

export const dynamic = "force-dynamic";

// GET: list all registered agents and their metadata
export async function GET() {
  return NextResponse.json({
    agents: ALL_AGENTS.map(a => ({
      type: a.type,
      name: a.name,
      weight: a.weight,
    })),
    count: ALL_AGENTS.length,
  });
}
