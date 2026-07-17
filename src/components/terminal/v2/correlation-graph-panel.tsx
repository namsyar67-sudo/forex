"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Network, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface GraphNode {
  id: string;
  label: string;
  group: string;
  color: string;
  strength: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  positive: boolean;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  threshold: number;
}

const THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7];

const GROUP_LABELS: Record<string, string> = {
  metals: "Metals",
  indices: "Indices",
  crypto: "Crypto",
  forex: "Forex",
};

// SVG canvas
const VIEW_W = 600;
const VIEW_H = 500;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const RADIUS = 175;

// Node size scale (clamp to a readable range)
const NODE_MIN = 9;
const NODE_MAX = 22;

// Edge styling bounds
const EDGE_MIN_W = 0.8;
const EDGE_MAX_W = 4;
const EDGE_MIN_O = 0.25;
const EDGE_MAX_O = 0.85;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * CorrelationGraphPanel — network visualization of inter-asset correlations.
 * Fetches `/api/correlation-graph?threshold=X` and renders an SVG radial graph
 * where nodes are assets, edges are correlations above the threshold.
 */
export function CorrelationGraphPanel() {
  const [data, setData] = useState<GraphData | null>(null);
  const [threshold, setThreshold] = useState<number>(0.4);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const fetchGraph = useCallback(async (thr: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/correlation-graph?threshold=${thr}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as GraphData;
      setData(json);
    } catch {
      setError(true);
      toast.error("Failed to load correlation graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph(threshold);
  }, [threshold, fetchGraph]);

  // ---- Compute radial node positions ---------------------------------------
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];

  const positions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    const N = nodes.length;
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI / Math.max(N, 1)) * i - Math.PI / 2;
      map[n.id] = {
        x: CX + RADIUS * Math.cos(angle),
        y: CY + RADIUS * Math.sin(angle),
      };
    });
    return map;
  }, [nodes]);

  // ---- Strength → radius mapping -------------------------------------------
  const strengthRange = useMemo(() => {
    if (nodes.length === 0) return { min: 0, max: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const n of nodes) {
      if (n.strength < min) min = n.strength;
      if (n.strength > max) max = n.strength;
    }
    if (max === min) max = min + 1;
    return { min, max };
  }, [nodes]);

  const radiusFor = useCallback(
    (s: number) => {
      const t = (s - strengthRange.min) / (strengthRange.max - strengthRange.min);
      return NODE_MIN + clamp(t, 0, 1) * (NODE_MAX - NODE_MIN);
    },
    [strengthRange]
  );

  // ---- Edge thickness helper -----------------------------------------------
  const effThreshold = data?.threshold ?? threshold;
  const thrSpan = Math.max(0.05, 1 - effThreshold);

  const strokeWidthFor = useCallback(
    (w: number) => {
      const t = clamp((w - effThreshold) / thrSpan, 0, 1);
      return EDGE_MIN_W + t * (EDGE_MAX_W - EDGE_MIN_W);
    },
    [effThreshold, thrSpan]
  );

  const opacityFor = useCallback(
    (w: number) => {
      const t = clamp((w - effThreshold) / thrSpan, 0, 1);
      return EDGE_MIN_O + t * (EDGE_MAX_O - EDGE_MIN_O);
    },
    [effThreshold, thrSpan]
  );

  // ---- Hover logic: set of nodes connected to hovered node ------------------
  const connectedSet = useMemo(() => {
    if (!hovered) return null;
    const s = new Set<string>([hovered]);
    for (const e of edges) {
      if (e.source === hovered) s.add(e.target);
      else if (e.target === hovered) s.add(e.source);
    }
    return s;
  }, [hovered, edges]);

  // ---- Strongest pair (for footer) -----------------------------------------
  const strongestEdge = useMemo(() => {
    if (edges.length === 0) return null;
    return edges.reduce((best, e) => (e.weight > best.weight ? e : best), edges[0]);
  }, [edges]);

  const strongestPairLabel = useMemo(() => {
    if (!strongestEdge) return "—";
    const sNode = nodes.find((n) => n.id === strongestEdge.source);
    const tNode = nodes.find((n) => n.id === strongestEdge.target);
    return `${sNode?.label ?? strongestEdge.source} ↔ ${tNode?.label ?? strongestEdge.target} (${strongestEdge.weight.toFixed(2)})`;
  }, [strongestEdge, nodes]);

  // ---- Render helpers -------------------------------------------------------
  const isEdgeDimmed = (e: GraphEdge): boolean =>
    hovered !== null && e.source !== hovered && e.target !== hovered;
  const isNodeDimmed = (id: string): boolean =>
    connectedSet !== null && !connectedSet.has(id);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Network className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">Correlation Graph</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              Inter-asset network · H1 returns
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 mr-1">
            {THRESHOLDS.map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                disabled={loading}
                className={`px-1.5 h-7 rounded text-[10px] tt-mono font-medium transition-colors border ${
                  threshold === t
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    : "bg-transparent text-slate-500 border-white/5 hover:text-slate-300 hover:bg-white/5"
                }`}
                title={`Show correlations ≥ ${t}`}
              >
                {t.toFixed(1)}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchGraph(threshold)}
            disabled={loading}
            className="h-7 w-7 p-0 shrink-0"
            title="Refresh"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll p-3">
        {loading && !data ? (
          <CorrelationGraphSkeleton />
        ) : error && !data ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center gap-2 text-slate-500">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div className="text-xs">Failed to load correlation graph.</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchGraph(threshold)}
              className="h-7 text-[11px]"
            >
              Retry
            </Button>
          </div>
        ) : nodes.length === 0 ? (
          <div className="h-full min-h-[260px] flex items-center justify-center text-xs text-slate-500">
            No correlation data available.
          </div>
        ) : (
          <div className="w-full">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="w-full h-auto"
              role="img"
              aria-label="Correlation network graph"
              style={{ maxHeight: 460 }}
            >
              {/* Faint concentric guide rings */}
              <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <circle cx={CX} cy={CY} r={RADIUS * 0.55} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth={1} />
              <circle cx={CX} cy={CY} r={2} fill="rgba(255,255,255,0.18)" />

              {/* Edges */}
              <g>
                {edges.map((e, i) => {
                  const s = positions[e.source];
                  const t = positions[e.target];
                  if (!s || !t) return null;
                  const dim = isEdgeDimmed(e);
                  const op = dim ? opacityFor(e.weight) * 0.08 : opacityFor(e.weight);
                  const sw = strokeWidthFor(e.weight) * (dim ? 0.6 : 1);
                  const color = e.positive ? "#10b981" : "#ef4444";
                  return (
                    <line
                      key={`e-${i}`}
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={color}
                      strokeWidth={sw}
                      strokeOpacity={op}
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>

              {/* Nodes */}
              <g>
                {nodes.map((n) => {
                  const p = positions[n.id];
                  if (!p) return null;
                  const r = radiusFor(n.strength);
                  const dim = isNodeDimmed(n.id);
                  const isHovered = hovered === n.id;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x},${p.y})`}
                      onMouseEnter={() => setHovered(n.id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{ cursor: "pointer", opacity: dim ? 0.35 : 1 }}
                    >
                      {/* Glow ring on hover */}
                      {isHovered && (
                        <circle
                          r={r + 5}
                          fill="none"
                          stroke={n.color}
                          strokeOpacity={0.45}
                          strokeWidth={1.2}
                        />
                      )}
                      <circle
                        r={r}
                        fill={n.color}
                        fillOpacity={isHovered ? 0.95 : 0.7}
                        stroke={n.color}
                        strokeOpacity={isHovered ? 1 : 0.55}
                        strokeWidth={isHovered ? 2 : 1}
                      />
                      {/* Strength label inside (only if big enough) */}
                      {r >= 14 && (
                        <text
                          y={3}
                          textAnchor="middle"
                          fontSize={9}
                          fontFamily="var(--font-mono, monospace)"
                          fill="rgba(7,9,13,0.85)"
                          fontWeight={600}
                          pointerEvents="none"
                        >
                          {n.strength.toFixed(1)}
                        </text>
                      )}
                      {/* Label below */}
                      <text
                        y={r + 12}
                        textAnchor="middle"
                        fontSize={10}
                        fill={isHovered ? "#e2e8f0" : "rgba(148,163,184,0.85)"}
                        fontWeight={isHovered ? 600 : 400}
                        pointerEvents="none"
                      >
                        {n.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Legend */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-400 px-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: "#10b981" }} />
                <span className="uppercase tracking-wider">Positive</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: "#ef4444" }} />
                <span className="uppercase tracking-wider">Negative</span>
              </div>
              <div className="h-3 w-px bg-white/10" />
              {Object.entries(GROUP_LABELS).map(([g, label]) => {
                const color =
                  g === "metals"
                    ? "#fbbf24"
                    : g === "indices"
                    ? "#a78bfa"
                    : g === "crypto"
                    ? "#fb923c"
                    : "#38bdf8";
                return (
                  <div key={g} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="uppercase tracking-wider">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-white/5 text-[10px]">
        <div className="flex items-center gap-4">
          <Stat label="Nodes" value={nodes.length.toString()} />
          <Stat label="Edges" value={edges.length.toString()} />
          <Stat label="Threshold" value={`≥ ${effThreshold.toFixed(1)}`} />
        </div>
        <div className="min-w-0 text-right">
          <div className="uppercase tracking-wider text-slate-500">Strongest</div>
          <div className="tt-mono text-emerald-300/90 truncate" title={strongestPairLabel}>
            {strongestPairLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="uppercase tracking-wider text-slate-500">{label}</div>
      <div className="tt-mono text-slate-200">{value}</div>
    </div>
  );
}

function CorrelationGraphSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <Skeleton className="w-[280px] h-[280px] rounded-full" />
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-12 rounded" />
        ))}
      </div>
      <div className="flex gap-4 mt-1">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

export default CorrelationGraphPanel;
