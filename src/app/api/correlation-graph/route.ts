import { NextResponse } from "next/server";
import { correlationMatrix } from "@/lib/market/analysis";
import { getCandles } from "@/lib/market/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Returns a network graph structure: nodes (assets) + edges (correlations above threshold)
const GRAPH_ASSETS = [
  { id: "XAUUSD", label: "Gold", group: "metals" },
  { id: "US30", label: "Dollar (Dow)", group: "indices" },
  { id: "NAS100", label: "Nasdaq", group: "indices" },
  { id: "BTCUSD", label: "Bitcoin", group: "crypto" },
  { id: "ETHUSD", label: "Ethereum", group: "crypto" },
  { id: "EURUSD", label: "EUR/USD", group: "forex" },
  { id: "GBPUSD", label: "GBP/USD", group: "forex" },
  { id: "USDJPY", label: "USD/JPY", group: "forex" },
  { id: "SPX500", label: "S&P 500", group: "indices" },
  { id: "GER40", label: "DAX", group: "indices" },
  { id: "UK100", label: "FTSE", group: "indices" },
];

const GROUP_COLORS: Record<string, string> = {
  metals: "#fbbf24",
  indices: "#a78bfa",
  crypto: "#fb923c",
  forex: "#38bdf8",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threshold = parseFloat(searchParams.get("threshold") || "0.4");
  const symbols = GRAPH_ASSETS.map((a) => a.id);
  const matrix = await correlationMatrix(symbols);

  const nodes = GRAPH_ASSETS.map((a, i) => {
    // Compute average absolute correlation strength for sizing
    let strength = 0;
    for (let j = 0; j < matrix[i].length; j++) {
      if (i !== j) strength += Math.abs(matrix[i][j]);
    }
    return {
      id: a.id,
      label: a.label,
      group: a.group,
      color: GROUP_COLORS[a.group],
      strength: Math.round(strength * 100) / 100,
    };
  });

  const edges: { source: string; target: string; weight: number; positive: boolean }[] = [];
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const corr = matrix[i][j];
      if (Math.abs(corr) >= threshold) {
        edges.push({
          source: symbols[i],
          target: symbols[j],
          weight: Math.round(Math.abs(corr) * 100) / 100,
          positive: corr > 0,
        });
      }
    }
  }

  // Sort edges by weight desc
  edges.sort((a, b) => b.weight - a.weight);

  return NextResponse.json({
    nodes,
    edges,
    matrix,
    symbols,
    threshold,
    time: Date.now(),
  });
}
