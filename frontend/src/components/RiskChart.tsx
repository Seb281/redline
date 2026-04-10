/** Mini donut chart showing risk level distribution. */

import type { RiskBreakdown } from "@/types";

interface RiskChartProps {
  breakdown: RiskBreakdown;
}

/** SVG donut chart for risk distribution — renders inline at 80x80. */
export function RiskChart({ breakdown }: RiskChartProps) {
  const total = breakdown.high + breakdown.medium + breakdown.low;
  if (total === 0) return null;

  const radius = 30;
  const circumference = 2 * Math.PI * radius;

  const highPct = breakdown.high / total;
  const medPct = breakdown.medium / total;
  const lowPct = breakdown.low / total;

  const highLen = highPct * circumference;
  const medLen = medPct * circumference;
  const lowLen = lowPct * circumference;

  const highOffset = 0;
  const medOffset = -(highLen);
  const lowOffset = -(highLen + medLen);

  return (
    <div className="flex flex-col items-center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--bg-tertiary)" strokeWidth="8" />
        {/* Low (green) — drawn first (bottom layer) */}
        {lowPct > 0 && (
          <circle
            cx="40" cy="40" r={radius}
            fill="none" stroke="#22c55e" strokeWidth="8"
            strokeDasharray={`${lowLen} ${circumference - lowLen}`}
            strokeDashoffset={lowOffset}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
        )}
        {/* Medium (yellow) */}
        {medPct > 0 && (
          <circle
            cx="40" cy="40" r={radius}
            fill="none" stroke="#eab308" strokeWidth="8"
            strokeDasharray={`${medLen} ${circumference - medLen}`}
            strokeDashoffset={medOffset}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
        )}
        {/* High (red) — drawn last (top layer) */}
        {highPct > 0 && (
          <circle
            cx="40" cy="40" r={radius}
            fill="none" stroke="#ef4444" strokeWidth="8"
            strokeDasharray={`${highLen} ${circumference - highLen}`}
            strokeDashoffset={highOffset}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
        )}
        <text x="40" y="44" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text-primary)">
          {total}
        </text>
      </svg>
      <p className="mt-1 text-xs text-[var(--text-muted)]">clauses</p>
    </div>
  );
}
