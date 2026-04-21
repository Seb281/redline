/**
 * SampleRow — editorial demo-contract row.
 *
 * Six sample contracts across the EU jurisdictions Redline understands
 * today. Each sample re-runs the live pipeline so the demo exercises
 * the same UX as a real upload (redaction preview, role picker, etc.).
 */

"use client";

import { useTranslations } from "next-intl";
import { SectionHead } from "@/components/ui/SectionHead";
import { MonoLabel } from "@/components/ui/MonoLabel";

type Sample = "nl" | "fr" | "de" | "es" | "it" | "pl";

const SAMPLES: { id: Sample; labelKey: string; kickerKey: string }[] = [
  { id: "nl", labelKey: "nlTitle", kickerKey: "nlKicker" },
  { id: "fr", labelKey: "frTitle", kickerKey: "frKicker" },
  { id: "de", labelKey: "deTitle", kickerKey: "deKicker" },
  { id: "es", labelKey: "esTitle", kickerKey: "esKicker" },
  { id: "it", labelKey: "itTitle", kickerKey: "itKicker" },
  { id: "pl", labelKey: "plTitle", kickerKey: "plKicker" },
];

export interface SampleRowProps {
  onPick: (sample: Sample) => void;
  disabled?: boolean;
}

export function SampleRow({ onPick, disabled = false }: SampleRowProps) {
  const t = useTranslations("Landing.Samples");
  return (
    <section className="mt-20">
      <SectionHead meta={t("meta")}>{t("title")}</SectionHead>
      <div className="mt-6 grid grid-cols-1 gap-0 border-t border-paper-edge sm:grid-cols-2 md:grid-cols-3">
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.id)}
            className="group flex items-baseline justify-between gap-4 border-b border-paper-edge px-0 py-4 text-left transition-colors hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:odd:border-r md:odd:border-r-0 md:[&:not(:nth-child(3n))]:border-r"
          >
            <span className="flex flex-col gap-1">
              <MonoLabel tone="muted">{t(s.kickerKey)}</MonoLabel>
              <span className="font-serif text-[20px] leading-tight text-ink">
                {t(s.labelKey)}
              </span>
            </span>
            <span
              aria-hidden
              className="t-mono-label text-ink-muted transition-colors group-hover:text-red-accent"
            >
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
