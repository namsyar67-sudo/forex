"use client";

import { useState, useEffect, useCallback } from "react";
import { Grid3x3, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface CorrelationPanelProps {
  className?: string;
}

interface CorrelationData {
  symbols: string[];
  matrix: number[][];
}

/**
 * Returns an inline-style background color reflecting correlation strength.
 * +1 -> emerald, -1 -> red, 0 -> transparent/neutral.
 */
function cellStyle(value: number, isDiagonal: boolean): React.CSSProperties {
  if (isDiagonal) {
    return {
      backgroundColor: "rgba(16, 185, 129, 0.18)",
    };
  }
  // Clamp -1..1
  const v = Math.max(-1, Math.min(1, value));
  const abs = Math.abs(v);
  if (abs < 0.05) {
    return { backgroundColor: "transparent" };
  }
  if (v > 0) {
    // emerald with alpha scaled by magnitude
    const alpha = (abs * 0.55).toFixed(3);
    return { backgroundColor: `rgba(16, 185, 129, ${alpha})` };
  }
  const alpha = (abs * 0.55).toFixed(3);
  return { backgroundColor: `rgba(239, 68, 68, ${alpha})` };
}

function cellTextClass(value: number, isDiagonal: boolean): string {
  if (isDiagonal) return "text-emerald-300 font-bold";
  if (value >= 0.7) return "text-emerald-200";
  if (value >= 0.3) return "text-emerald-300/80";
  if (value <= -0.7) return "text-red-200";
  if (value <= -0.3) return "text-red-300/80";
  return "text-slate-400";
}

export function CorrelationPanel({ className }: CorrelationPanelProps) {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/correlation", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as CorrelationData;
      setData(json);
    } catch {
      toast.error("Failed to load correlation matrix");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const symbols = data?.symbols ?? [];
  const matrix = data?.matrix ?? [];

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Grid3x3 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">Correlation Matrix</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              H1 returns · 100 bars
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchMatrix}
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

      {/* Body */}
      <div className="flex-1 overflow-auto tt-scroll p-2">
        {loading && !data ? (
          <div className="space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-1.5">
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-6 w-12 rounded-sm" />
                ))}
              </div>
            ))}
          </div>
        ) : symbols.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 py-12">
            No correlation data available.
          </div>
        ) : (
          <table className="border-separate border-spacing-0 text-[10px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-[#0a0d12] backdrop-blur-sm px-1 py-1 text-left">
                  <span className="sr-only">Symbols</span>
                </th>
                {symbols.map((s) => (
                  <th
                    key={s}
                    className="sticky top-0 z-10 bg-[#0a0d12] backdrop-blur-sm px-1 py-1 text-center font-semibold text-slate-400 whitespace-nowrap "
                    title={s}
                  >
                    <span className="tt-mono">{s.length > 6 ? s.slice(0, 6) : s}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={symbols[i] ?? i}>
                  <th
                    className="sticky left-0 z-10 bg-[#0a0d12] backdrop-blur-sm px-1.5 py-1 text-right font-semibold text-slate-400 whitespace-nowrap"
                    title={symbols[i]}
                  >
                    <span className="tt-mono">
                      {(symbols[i] ?? "").length > 7
                        ? (symbols[i] ?? "").slice(0, 7)
                        : (symbols[i] ?? "")}
                    </span>
                  </th>
                  {row.map((val, j) => {
                    const isDiagonal = i === j;
                    return (
                      <td
                        key={j}
                        style={cellStyle(val, isDiagonal)}
                        className="text-center px-1 py-1 border border-white/5  h-[24px]"
                        title={`${symbols[i]} × ${symbols[j]}: ${val.toFixed(2)}`}
                      >
                        <span className={`tt-mono ${cellTextClass(val, isDiagonal)}`}>
                          {val.toFixed(2)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5 text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span>−1</span>
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.55)" }}
          />
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.25)" }}
          />
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.25)" }}
          />
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.55)" }}
          />
          <span>+1</span>
        </div>
        <span className="text-[9px] uppercase tracking-wider">Diagonal = self</span>
      </div>
    </div>
  );
}
