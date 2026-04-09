/** Color-coded risk level badge. */

import type { RiskLevel } from "@/types";

const STYLES: Record<RiskLevel, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

interface RiskBadgeProps {
  level: RiskLevel;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${STYLES[level]}`}
    >
      {level} risk
    </span>
  );
}
