/**
 * Latency Tracker
 * Measures end-to-end timing: news arrival → processing → reanalysis → notification.
 *
 * If news arrives a minute late, the opportunity is already gone.
 * This tracker helps identify bottlenecks and improve speed.
 */
import { db } from "@/lib/db";

export interface LatencyMeasurement {
  metricType: "news_arrival" | "processing" | "reanalysis" | "notification" | "total";
  symbol?: string;
  valueMs: number;
  context?: Record<string, any>;
}

// In-memory recent metrics for quick stats
declare global {
  var __latencyMetrics: LatencyMeasurement[] | undefined;
}

function getMetrics(): LatencyMeasurement[] {
  if (!global.__latencyMetrics) global.__latencyMetrics = [];
  return global.__latencyMetrics;
}

// ---------- Timers ----------
const timers = new Map<string, { start: number; type: string; symbol?: string }>();

export function startTimer(id: string, type: string, symbol?: string): void {
  timers.set(id, { start: Date.now(), type, symbol });
}

export function endTimer(id: string, context?: Record<string, any>): number | null {
  const timer = timers.get(id);
  if (!timer) return null;
  const elapsed = Date.now() - timer.start;
  timers.delete(id);

  recordLatency({
    metricType: timer.type as any,
    symbol: timer.symbol,
    valueMs: elapsed,
    context,
  });

  return elapsed;
}

// ---------- Recording ----------
export async function recordLatency(metric: LatencyMeasurement): Promise<void> {
  // Keep in memory (last 500)
  const metrics = getMetrics();
  metrics.push(metric);
  if (metrics.length > 500) metrics.shift();

  // Persist to DB (fire and forget, non-blocking)
  try {
    await db.latencyMetric.create({
      data: {
        metricType: metric.metricType,
        symbol: metric.symbol || null,
        valueMs: metric.valueMs,
        context: metric.context ? JSON.stringify(metric.context) : null,
      },
    });
  } catch {
    // non-fatal
  }
}

// ---------- Stats ----------
export interface LatencyStats {
  newsArrival: { avg: number; min: number; max: number; p95: number; count: number };
  processing: { avg: number; min: number; max: number; p95: number; count: number };
  reanalysis: { avg: number; min: number; max: number; p95: number; count: number };
  notification: { avg: number; min: number; max: number; p95: number; count: number };
  total: { avg: number; min: number; max: number; p95: number; count: number };
}

export function getLatencyStatsFromMemory(): LatencyStats {
  const metrics = getMetrics();
  return {
    newsArrival: computeStats(metrics.filter(m => m.metricType === "news_arrival")),
    processing: computeStats(metrics.filter(m => m.metricType === "processing")),
    reanalysis: computeStats(metrics.filter(m => m.metricType === "reanalysis")),
    notification: computeStats(metrics.filter(m => m.metricType === "notification")),
    total: computeStats(metrics.filter(m => m.metricType === "total")),
  };
}

function computeStats(items: LatencyMeasurement[]) {
  if (items.length === 0) {
    return { avg: 0, min: 0, max: 0, p95: 0, count: 0 };
  }
  const values = items.map(m => m.valueMs).sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const p95Index = Math.floor(values.length * 0.95);
  return {
    avg: Math.round(sum / values.length),
    min: values[0],
    max: values[values.length - 1],
    p95: values[Math.min(p95Index, values.length - 1)],
    count: values.length,
  };
}

// ---------- DB-based stats (for longer history) ----------
export async function getLatencyStatsFromDB(hoursBack = 24): Promise<LatencyStats> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const types: LatencyStats[keyof LatencyStats]["avg"] extends number ? keyof LatencyStats : never[] = [] as any;
  const metricTypes = ["news_arrival", "processing", "reanalysis", "notification", "total"] as const;

  const result: any = {};
  for (const type of metricTypes) {
    const rows = await db.latencyMetric.findMany({
      where: { metricType: type, createdAt: { gt: since } },
      orderBy: { valueMs: "asc" },
      take: 1000,
    });
    result[type] = computeStats(rows.map(r => ({ metricType: type, valueMs: r.valueMs })));
  }

  return result as LatencyStats;
}
