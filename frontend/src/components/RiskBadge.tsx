/** Color-coded risk level badge — thin wrapper around the shared RiskChip primitive. */

"use client";

import { useTranslations } from "next-intl";
import type { RiskLevel } from "@/types";
import { RiskChip } from "@/components/ui/RiskChip";

interface RiskBadgeProps {
  level: RiskLevel;
}

/** Renders a small editorial chip indicating risk level. */
export function RiskBadge({ level }: RiskBadgeProps) {
  const t = useTranslations("RiskBadge");
  const label = level === "informational" ? t("info") : t("level", { level });
  return <RiskChip level={level} label={label} size="md" />;
}
