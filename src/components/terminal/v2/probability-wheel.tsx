"use client";

interface ProbabilityWheelProps {
  buy: number;
  sell: number;
  wait: number;
  size?: number;
}

const SEGMENT_COLORS = {
  buy: "#10b981",
  sell: "#ef4444",
  wait: "#64748b",
} as const;

type SegmentKey = keyof typeof SEGMENT_COLORS;

/**
 * ProbabilityWheel — circular donut chart visualising Buy / Sell / Wait
 * probabilities. Uses SVG circles with stroke-dasharray for the segments.
 * The dominant segment's colour tints the centre readout.
 */
export function ProbabilityWheel({ buy, sell, wait, size = 160 }: ProbabilityWheelProps) {
  const total = Math.max(1, buy + sell + wait);
  const buyPct = buy / total;
  const sellPct = sell / total;
  const waitPct = wait / total;

  const strokeWidth = Math.max(8, Math.round(size * 0.13));
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const buyLen = buyPct * circumference;
  const sellLen = sellPct * circumference;
  const waitLen = waitPct * circumference;

  // Stacked segments using stroke-dashoffset (negative shifts the start clockwise).
  const segments: { key: SegmentKey; len: number; offset: number }[] = [
    { key: "buy", len: buyLen, offset: 0 },
    { key: "sell", len: sellLen, offset: -buyLen },
    { key: "wait", len: waitLen, offset: -(buyLen + sellLen) },
  ];

  // Determine dominant segment.
  let dominant: SegmentKey = "wait";
  if (buy >= sell && buy >= wait) dominant = "buy";
  else if (sell >= buy && sell >= wait) dominant = "sell";

  const dominantColor = SEGMENT_COLORS[dominant];
  const dominantLabel = dominant.toUpperCase();
  const displayPct = Math.round(
    Math.max(0, dominant === "buy" ? buy : dominant === "sell" ? sell : wait)
  );

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
          role="img"
          aria-label={`Probability: ${displayPct}% ${dominantLabel}`}
        >
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg) => (
            <circle
              key={seg.key}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={SEGMENT_COLORS[seg.key]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${Math.max(0, seg.len)} ${circumference}`}
              strokeDashoffset={seg.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          ))}
        </svg>

        {/* Centre readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-[9px] uppercase tracking-[0.15em] font-semibold"
            style={{ color: dominantColor }}
          >
            {dominantLabel}
          </span>
          <span
            className="text-2xl font-bold tt-mono leading-none mt-0.5"
            style={{ color: dominantColor }}
          >
            {displayPct}
            <span className="text-sm">%</span>
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 w-full">
        <LegendItem label="Buy" pct={Math.round(Math.max(0, buy))} color={SEGMENT_COLORS.buy} />
        <LegendItem label="Sell" pct={Math.round(Math.max(0, sell))} color={SEGMENT_COLORS.sell} />
        <LegendItem label="Wait" pct={Math.round(Math.max(0, wait))} color={SEGMENT_COLORS.wait} />
      </div>
    </div>
  );
}

function LegendItem({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 justify-center rounded-md bg-black/20 border border-white/5 px-1.5 py-1">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
      />
      <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-[11px] tt-mono text-slate-200 ml-auto">{pct}%</span>
    </div>
  );
}

export default ProbabilityWheel;
