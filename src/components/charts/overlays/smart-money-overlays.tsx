"use client";

/**
 * SmartMoneyOverlays
 * ------------------
 * Renders Smart Money Concepts (SMC) overlay layers ON TOP of the existing
 * CandleChart. The layout math below mirrors `src/components/charts/candle-chart.tsx`
 * exactly so SVG coordinates line up with the candles underneath.
 *
 * The component returns a transparent, pointer-events-none <svg> sized to the
 * chart. The parent container must be `position: relative` so this overlay can
 * be absolutely positioned over the candle chart.
 *
 * Layers (toggleable via the `layers` prop):
 *   - orderBlocks     : bullish (emerald) / bearish (red) filled zones
 *   - fvg             : fair value gaps, dashed border, low-opacity fill
 *   - liquidity       : buy-side (amber) / sell-side (sky) dashed lines + swept labels
 *   - breaks          : BOS (white/cyan) / CHOCH (amber/orange) triangle markers
 *   - equalLevels     : EQH / EQL dotted lines
 *   - premiumDiscount : right-edge premium (red) / discount (emerald) gradient band
 *   - swings          : swing high (red) / swing low (emerald) dots
 */

import { useMemo } from "react";
import type { Candle } from "@/lib/indicators/indicators";
import type { SmartMoneyAnalysis } from "@/lib/smart-money/engine";

export interface SmartMoneyOverlayLayers {
  orderBlocks: boolean;
  fvg: boolean;
  liquidity: boolean;
  breaks: boolean;
  equalLevels: boolean;
  premiumDiscount: boolean;
  swings: boolean;
}

export interface SmartMoneyOverlaysProps {
  candles: Candle[];
  analysis: SmartMoneyAnalysis;
  digits: number;
  showVolume: boolean;
  height: number;
  width: number;
  layers: SmartMoneyOverlayLayers;
}

interface ChartView {
  padding: { top: number; right: number; bottom: number; left: number };
  priceH: number;
  volH: number;
  chartW: number;
  yMax: number;
  yMin: number;
  range: number;
  n: number;
  candleW: number;
  x: (i: number) => number;
  y: (price: number) => number;
  xLeft: (i: number) => number;
  chartLeft: number;
  chartRight: number;
  priceTop: number;
  priceBottom: number;
  lastIdx: number;
}

// Palette — aligned with the terminal's market colours.
const C = {
  bull: "#10b981",
  bear: "#ef4444",
  amber: "#f59e0b",
  sky: "#38bdf8",
  white: "#e2e8f0",
  cyan: "#22d3ee",
  orange: "#fb923c",
  slate: "#64748b",
};

function buildView(
  candles: Candle[],
  width: number,
  height: number,
  showVolume: boolean
): ChartView | null {
  if (candles.length === 0) return null;
  const padding = { top: 12, right: 64, bottom: showVolume ? 60 : 24, left: 8 };
  const volH = showVolume ? 44 : 0;
  const priceH = Math.max(40, height - padding.top - padding.bottom - volH - 8);
  const chartW = Math.max(100, width - padding.left - padding.right);

  const max = Math.max(...candles.map((c) => c.high));
  const min = Math.min(...candles.map((c) => c.low));
  const pad = (max - min) * 0.08;
  const yMax = max + pad;
  const yMin = min - pad;
  const range = yMax - yMin || 1;

  const n = candles.length;
  const candleW = chartW / n;

  const x = (i: number) => padding.left + i * candleW + candleW / 2;
  const y = (price: number) =>
    padding.top + ((yMax - price) / range) * priceH;
  const xLeft = (i: number) => padding.left + i * candleW;

  return {
    padding,
    priceH,
    volH,
    chartW,
    yMax,
    yMin,
    range,
    n,
    candleW,
    x,
    y,
    xLeft,
    chartLeft: padding.left,
    chartRight: padding.left + chartW,
    priceTop: padding.top,
    priceBottom: padding.top + priceH,
    lastIdx: n - 1,
  };
}

const clampIdx = (i: number, lastIdx: number) =>
  Math.max(0, Math.min(lastIdx, i));

export function SmartMoneyOverlays({
  candles,
  analysis,
  digits,
  showVolume,
  height,
  width,
  layers,
}: SmartMoneyOverlaysProps) {
  const view = useMemo(
    () => buildView(candles, width, height, showVolume),
    [candles, width, height, showVolume]
  );

  if (!view) return null;
  const v = view;
  const { x, y, xLeft } = v;

  // ---------- Order Blocks ----------
  const orderBlockEls = layers.orderBlocks
    ? analysis.orderBlocks
        .filter((ob) => ob.startIndex <= v.lastIdx)
        .map((ob, i) => {
          const startIdx = clampIdx(ob.startIndex, v.lastIdx);
          const endIdx =
            ob.mitigated && ob.mitigationIndex != null
              ? clampIdx(ob.mitigationIndex, v.lastIdx)
              : v.lastIdx;
          const x1 = xLeft(startIdx);
          const x2 = xLeft(endIdx + 1);
          const w = Math.max(2, x2 - x1);
          const yTop = y(ob.top);
          const yBot = y(ob.bottom);
          const h = Math.max(1.5, yBot - yTop);
          const color = ob.type === "bullish" ? C.bull : C.bear;
          const opacity = ob.mitigated ? 0.08 : 0.15;
          return (
            <g key={`ob-${i}`}>
              <rect
                x={x1}
                y={yTop}
                width={w}
                height={h}
                fill={color}
                fillOpacity={opacity}
                stroke={color}
                strokeOpacity={ob.mitigated ? 0.35 : 0.7}
                strokeWidth={1}
              />
              <text
                x={x1 + 3}
                y={yTop + 10}
                fill={color}
                fillOpacity={ob.mitigated ? 0.45 : 0.85}
                fontSize={8}
                className="tt-mono"
              >
                {ob.type === "bullish" ? "OB↑" : "OB↓"}
                {ob.mitigated ? " ·m" : ""}
              </text>
            </g>
          );
        })
    : null;

  // ---------- Fair Value Gaps ----------
  const fvgEls = layers.fvg
    ? analysis.fairValueGaps
        .filter((f) => f.startIndex <= v.lastIdx)
        .map((f, i) => {
          const startIdx = clampIdx(f.startIndex, v.lastIdx);
          const endIdx =
            f.filled && f.fillIndex != null
              ? clampIdx(f.fillIndex, v.lastIdx)
              : v.lastIdx;
          const x1 = xLeft(startIdx);
          const x2 = xLeft(endIdx + 1);
          const w = Math.max(2, x2 - x1);
          const yTop = y(f.top);
          const yBot = y(f.bottom);
          const h = Math.max(1, yBot - yTop);
          const color = f.type === "bullish" ? C.bull : C.bear;
          const opacity = f.filled ? 0.08 : 0.2;
          return (
            <g key={`fvg-${i}`}>
              <rect
                x={x1}
                y={yTop}
                width={w}
                height={h}
                fill={color}
                fillOpacity={opacity}
                stroke={color}
                strokeOpacity={f.filled ? 0.3 : 0.6}
                strokeWidth={0.75}
                strokeDasharray="2 2"
              />
            </g>
          );
        })
    : null;

  // ---------- Liquidity Zones ----------
  const liquidityEls = layers.liquidity
    ? analysis.liquidityZones
        .filter((z) => z.index <= v.lastIdx)
        .map((z, i) => {
          const startIdx = clampIdx(z.index, v.lastIdx);
          const endIdx =
            z.swept && z.sweepIndex != null
              ? clampIdx(z.sweepIndex, v.lastIdx)
              : v.lastIdx;
          const x1 = x(startIdx);
          const x2 = x(endIdx);
          const yp = y(z.price);
          const color = z.type === "buy-side" ? C.amber : C.sky;
          const opacity = z.swept ? 0.35 : 0.7;
          const midX = (x1 + x2) / 2;
          return (
            <g key={`liq-${i}`} opacity={opacity}>
              <line
                x1={x1}
                y1={yp}
                x2={x2}
                y2={yp}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text
                x={x2 - 2}
                y={yp - 3}
                fill={color}
                fontSize={8}
                textAnchor="end"
                className="tt-mono"
              >
                {z.type === "buy-side" ? "BSL" : "SSL"}
                {z.swept ? " ·swept" : ""}
              </text>
              {z.swept && (
                <text
                  x={midX}
                  y={yp - 3}
                  fill={color}
                  fontSize={7.5}
                  textAnchor="middle"
                  className="tt-mono"
                  opacity={0.6}
                >
                  swept
                </text>
              )}
            </g>
          );
        })
    : null;

  // ---------- Structure Breaks (BOS / CHOCH) ----------
  const breakEls = layers.breaks
    ? analysis.breaks
        .filter((b) => b.breakIndex <= v.lastIdx)
        .map((b, i) => {
          const bx = x(b.breakIndex);
          const by = y(b.brokenLevel);
          const isCHOCH = b.type === "CHOCH";
          const color = isCHOCH ? C.amber : C.white;
          const accent = isCHOCH ? C.orange : C.cyan;
          const size = 5;
          // Bullish break → triangle pointing up, placed just below the broken level.
          // Bearish break → triangle pointing down, placed just above the broken level.
          const dir = b.direction;
          const cy = dir === "bullish" ? by + size + 2 : by - size - 2;
          const points =
            dir === "bullish"
              ? `${bx},${cy + size} ${bx - size},${cy} ${bx + size},${cy}`
              : `${bx},${cy - size} ${bx - size},${cy} ${bx + size},${cy}`;
          return (
            <g key={`brk-${i}`}>
              <polygon
                points={points}
                fill={color}
                fillOpacity={0.85}
                stroke={accent}
                strokeWidth={0.75}
              />
              <text
                x={bx + size + 2}
                y={cy + 3}
                fill={color}
                fontSize={8}
                className="tt-mono"
                opacity={0.9}
              >
                {isCHOCH ? "CHOCH" : "BOS"}
              </text>
            </g>
          );
        })
    : null;

  // ---------- Equal Highs / Lows ----------
  const equalEls = layers.equalLevels
    ? analysis.equalLevels
        .filter((l) => l.indices.some((idx) => idx <= v.lastIdx))
        .map((l, i) => {
          const idxs = l.indices.filter((idx) => idx >= 0 && idx <= v.lastIdx);
          if (idxs.length < 2) return null;
          const minIdx = Math.min(...idxs);
          const maxIdx = Math.max(...idxs);
          const x1 = x(minIdx);
          const x2 = x(maxIdx);
          const yp = y(l.price);
          const color = l.type === "equal-highs" ? C.amber : C.sky;
          const label = l.type === "equal-highs" ? "EQH" : "EQL";
          return (
            <g key={`eq-${i}`}>
              <line
                x1={x1}
                y1={yp}
                x2={x2}
                y2={yp}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="1 2.5"
                opacity={0.8}
              />
              <text
                x={x1}
                y={yp - 3}
                fill={color}
                fontSize={8}
                className="tt-mono"
                opacity={0.85}
              >
                {label}
              </text>
            </g>
          );
        })
    : null;

  // ---------- Premium / Discount band ----------
  // A thin vertical strip on the right edge of the plotting area:
  //   top 35% = red "Premium", bottom 35% = emerald "Discount",
  //   middle = dashed "Equilibrium" line at the chart's vertical midpoint.
  const pdEls = layers.premiumDiscount ? (
    <g>
      <defs>
        <linearGradient id="smc-premium-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.bear} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.bear} stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="smc-discount-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.bull} stopOpacity="0.05" />
          <stop offset="100%" stopColor={C.bull} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {(() => {
        const bandX = v.chartRight - 8;
        const bandW = 8;
        const zoneH = v.priceH * 0.35;
        const premiumY = v.priceTop;
        const discountY = v.priceTop + v.priceH - zoneH;
        const eqY = v.priceTop + v.priceH / 2;
        return (
          <>
            {/* Premium (top 35%) */}
            <rect
              x={bandX}
              y={premiumY}
              width={bandW}
              height={zoneH}
              fill="url(#smc-premium-grad)"
              stroke={C.bear}
              strokeOpacity={0.4}
              strokeWidth={0.5}
            />
            {/* Discount (bottom 35%) */}
            <rect
              x={bandX}
              y={discountY}
              width={bandW}
              height={zoneH}
              fill="url(#smc-discount-grad)"
              stroke={C.bull}
              strokeOpacity={0.4}
              strokeWidth={0.5}
            />
            {/* Equilibrium line spanning the chart */}
            <line
              x1={v.chartLeft}
              y1={eqY}
              x2={v.chartRight}
              y2={eqY}
              stroke={C.slate}
              strokeWidth={0.75}
              strokeDasharray="6 4"
              opacity={0.5}
            />
            {/* Labels (placed in the right-axis gutter) */}
            <text
              x={v.chartRight + 4}
              y={premiumY + 10}
              fill={C.bear}
              fontSize={8}
              className="tt-mono"
              opacity={0.85}
            >
              Prem
            </text>
            <text
              x={v.chartRight + 4}
              y={eqY + 3}
              fill={C.slate}
              fontSize={8}
              className="tt-mono"
              opacity={0.8}
            >
              Eq
            </text>
            <text
              x={v.chartRight + 4}
              y={discountY + zoneH - 2}
              fill={C.bull}
              fontSize={8}
              className="tt-mono"
              opacity={0.85}
            >
              Disc
            </text>
            {/* Current price position marker on the band */}
            {(() => {
              const pos = analysis.premiumDiscount?.position;
              if (typeof pos !== "number") return null;
              const py = v.priceTop + pos * v.priceH;
              const dotColor =
                pos > 0.65 ? C.bear : pos < 0.35 ? C.bull : C.amber;
              return (
                <circle
                  cx={bandX + bandW / 2}
                  cy={py}
                  r={2.5}
                  fill={dotColor}
                  stroke="#0a0e14"
                  strokeWidth={0.75}
                />
              );
            })()}
          </>
        );
      })()}
    </g>
  ) : null;

  // ---------- Swing points ----------
  const swingEls = layers.swings
    ? analysis.swings
        .filter((s) => s.index >= 0 && s.index <= v.lastIdx)
        .map((s, i) => {
          const sx = x(s.index);
          const sy = y(s.price);
          const isHigh = s.type === "high";
          const color = isHigh ? C.bear : C.bull;
          const dotY = isHigh ? sy - 7 : sy + 7;
          return (
            <g key={`sw-${i}`}>
              <circle
                cx={sx}
                cy={dotY}
                r={2.5}
                fill={color}
                fillOpacity={s.confirmed ? 0.95 : 0.5}
                stroke="#0a0e14"
                strokeWidth={0.5}
              />
            </g>
          );
        })
    : null;

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    >
      {pdEls}
      {orderBlockEls}
      {fvgEls}
      {liquidityEls}
      {equalEls}
      {breakEls}
      {swingEls}
    </svg>
  );
}

export default SmartMoneyOverlays;
