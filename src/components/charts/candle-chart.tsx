"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import type { Candle } from "@/lib/types";

interface CandleChartProps {
  candles: Candle[];
  digits: number;
  height?: number;
  showVolume?: boolean;
  ema20?: number[];
  ema50?: number[];
  bbUpper?: number[];
  bbLower?: number[];
}

// Lightweight SVG candlestick chart with terminal styling
export function CandleChart({
  candles,
  digits,
  height = 360,
  showVolume = true,
  ema20,
  ema50,
  bbUpper,
  bbLower,
}: CandleChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const padding = { top: 12, right: 64, bottom: showVolume ? 60 : 24, left: 8 };
    const volH = showVolume ? 44 : 0;
    const priceH = height - padding.top - padding.bottom - volH - 8;
    const chartW = Math.max(100, width - padding.left - padding.right);
    return { padding, priceH, volH, chartW };
  }, [width, height, showVolume]);

  const view = useMemo(() => {
    if (candles.length === 0) return null;
    const max = Math.max(...candles.map((c) => c.high));
    const min = Math.min(...candles.map((c) => c.low));
    const pad = (max - min) * 0.08;
    const yMax = max + pad;
    const yMin = min - pad;
    const range = yMax - yMin || 1;
    const maxVol = Math.max(...candles.map((c) => c.volume), 1);

    const n = candles.length;
    const candleW = layout.chartW / n;
    const bodyW = Math.max(1.5, candleW * 0.62);

    const x = (i: number) => layout.padding.left + i * candleW + candleW / 2;
    const y = (price: number) =>
      layout.padding.top + ((yMax - price) / range) * layout.priceH;

    return { yMax, yMin, range, maxVol, candleW, bodyW, x, y, n };
  }, [candles, layout]);

  if (!view || candles.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center text-sm text-slate-500"
        style={{ height }}
      >
        Loading chart data…
      </div>
    );
  }

  const { yMax, yMin, range, maxVol, bodyW, x, y } = view;

  // Price grid lines (5 levels)
  const gridLevels = Array.from({ length: 5 }, (_, i) => yMin + (range * i) / 4);
  // Time labels (every ~n/6)
  const timeSteps = Math.max(1, Math.floor(view.n / 6));
  const timeLabels = candles
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => i % timeSteps === 0);

  // EMA line paths
  const linePath = (arr?: number[]) => {
    if (!arr || arr.length === 0) return "";
    const offset = candles.length - arr.length;
    return arr
      .map((v, i) => {
        const idx = i + offset;
        if (idx < 0 || !isFinite(v) || isNaN(v)) return "";
        const px = x(idx);
        const py = y(v);
        if (!isFinite(px) || !isFinite(py) || isNaN(px) || isNaN(py)) return "";
        return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  };

  const hoverCandle = hover !== null ? candles[hover] : null;
  const lastCandle = candles[candles.length - 1];
  const lastPrice = lastCandle.close;
  const prevPrice = candles.length > 1 ? candles[candles.length - 2].close : lastPrice;
  const priceUp = lastPrice >= prevPrice;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <svg
        width={width}
        height={height}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const idx = Math.floor((mx - layout.padding.left) / view.candleW);
          if (idx >= 0 && idx < candles.length) setHover(idx);
          else setHover(null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines + price labels */}
        {gridLevels.map((lvl, i) => (
          <g key={i}>
            <line
              x1={layout.padding.left}
              y1={y(lvl)}
              x2={layout.padding.left + layout.chartW}
              y2={y(lvl)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
            <text
              x={layout.padding.left + layout.chartW + 6}
              y={y(lvl) + 3}
              fill="#5a6573"
              fontSize={10}
              className="tt-mono"
            >
              {lvl.toFixed(digits)}
            </text>
          </g>
        ))}

        {/* Bollinger bands */}
        {bbUpper && bbLower && (
          <>
            <path d={linePath(bbUpper)} fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth={1} strokeDasharray="3 3" />
            <path d={linePath(bbLower)} fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth={1} strokeDasharray="3 3" />
          </>
        )}

        {/* EMA lines */}
        {ema20 && <path d={linePath(ema20)} fill="none" stroke="#f59e0b" strokeWidth={1.2} opacity={0.8} />}
        {ema50 && <path d={linePath(ema50)} fill="none" stroke="#14b8a6" strokeWidth={1.2} opacity={0.8} />}

        {/* Candles */}
        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? "#10b981" : "#ef4444";
          const bodyTop = y(Math.max(c.open, c.close));
          const bodyBottom = y(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBottom - bodyTop);
          const cx = x(i);
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
              <line x1={cx} y1={y(c.high)} x2={cx} y2={y(c.low)} stroke={color} strokeWidth={1} />
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={color}
                opacity={up ? 0.9 : 0.95}
              />
            </g>
          );
        })}

        {/* Volume bars */}
        {showVolume &&
          candles.map((c, i) => {
            const up = c.close >= c.open;
            const vh = (c.volume / maxVol) * layout.volH;
            const cx = x(i);
            return (
              <rect
                key={`v${i}`}
                x={cx - bodyW / 2}
                y={layout.padding.top + layout.priceH + 8 + (layout.volH - vh)}
                width={bodyW}
                height={vh}
                fill={up ? "#10b981" : "#ef4444"}
                opacity={0.25}
              />
            );
          })}

        {/* Last price line */}
        <line
          x1={layout.padding.left}
          y1={y(lastPrice)}
          x2={layout.padding.left + layout.chartW}
          y2={y(lastPrice)}
          stroke={priceUp ? "#10b981" : "#ef4444"}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />
        <rect
          x={layout.padding.left + layout.chartW + 2}
          y={y(lastPrice) - 9}
          width={56}
          height={18}
          fill={priceUp ? "#10b981" : "#ef4444"}
          rx={2}
        />
        <text
          x={layout.padding.left + layout.chartW + 6}
          y={y(lastPrice) + 4}
          fill="#0a0e14"
          fontSize={10}
          fontWeight={700}
          className="tt-mono"
        >
          {lastPrice.toFixed(digits)}
        </text>

        {/* Time labels */}
        {timeLabels.map(({ c, i }) => (
          <text
            key={`t${i}`}
            x={x(i)}
            y={height - 6}
            fill="#5a6573"
            fontSize={9}
            textAnchor="middle"
            className="tt-mono"
          >
            {new Date(c.time * 1000).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </text>
        ))}

        {/* Hover crosshair */}
        {hover !== null && hoverCandle && (
          <g>
            <line
              x1={x(hover)}
              y1={layout.padding.top}
              x2={x(hover)}
              y2={layout.padding.top + layout.priceH}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hover !== null && hoverCandle && (
        <div
          className="absolute pointer-events-none tt-glass-strong rounded-md px-3 py-2 text-xs tt-mono z-10"
          style={{
            left: Math.min(width - 180, Math.max(8, x(hover) - 80)),
            top: 8,
          }}
        >
          <div className="text-slate-400 mb-1">
            {new Date(hoverCandle.time * 1000).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-slate-500">O</span>
            <span className="text-slate-200">{hoverCandle.open.toFixed(digits)}</span>
            <span className="text-slate-500">H</span>
            <span className="tt-text-up">{hoverCandle.high.toFixed(digits)}</span>
            <span className="text-slate-500">L</span>
            <span className="tt-text-down">{hoverCandle.low.toFixed(digits)}</span>
            <span className="text-slate-500">C</span>
            <span className="text-slate-200">{hoverCandle.close.toFixed(digits)}</span>
            <span className="text-slate-500">Vol</span>
            <span className="text-slate-300">{hoverCandle.volume.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
