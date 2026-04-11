/**
 * Renders a clause's plain-English narrative with inline [^N] citation
 * markers. Clicking a marker scrolls to the matching footnote in the
 * footnote list below and records the origin in CitationNavContext so
 * the footnote can offer a return button.
 */

"use client";

import { useCallback } from "react";
import { useCitationNav } from "@/contexts/CitationNavContext";
import { parseExplanation } from "@/lib/citations";
import type { AnalyzedClause } from "@/types";

interface ClauseExplanationProps {
  plainEnglish: string;
  citations: AnalyzedClause["citations"];
  clauseText: string;
  /** Stable id unique to this clause card — used to scope footnote DOM ids. */
  cardId: string;
}

/** Briefly flash-highlight an element after scrolling to it. */
function flash(element: HTMLElement) {
  element.classList.add("citation-flash");
  window.setTimeout(() => element.classList.remove("citation-flash"), 800);
}

export function ClauseExplanation({
  plainEnglish,
  citations,
  clauseText,
  cardId,
}: ClauseExplanationProps) {
  const { originId, setOrigin, clearOrigin } = useCitationNav();

  const segments = (() => {
    try {
      return parseExplanation(plainEnglish, citations, clauseText);
    } catch {
      // Last-resort fallback: render the narrative as one text segment.
      return [{ kind: "text" as const, value: plainEnglish }];
    }
  })();

  const citeSegments = segments.filter(
    (s): s is Extract<typeof s, { kind: "cite" }> => s.kind === "cite",
  );

  const narrativeId = `narrative-${cardId}`;

  const handleMarkerClick = useCallback(
    (id: number, markerId: string) => {
      setOrigin(markerId);
      const target = document.getElementById(`cite-${cardId}-${id}`);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        flash(target);
      }
    },
    [cardId, setOrigin],
  );

  const handleReturn = useCallback(() => {
    if (!originId) return;
    const target = document.getElementById(originId);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      flash(target);
    }
    clearOrigin();
  }, [originId, clearOrigin]);

  const isOriginWithinThisCard = originId?.startsWith(`marker-${cardId}-`) ?? false;

  return (
    <div>
      <p
        id={narrativeId}
        className="text-[15px] leading-relaxed text-[var(--text-secondary)] font-[var(--font-body)]"
      >
        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return <span key={`t-${i}`}>{seg.value}</span>;
          }
          const markerId = `marker-${cardId}-${seg.id}`;
          return (
            <sup key={`m-${i}`} id={markerId} className="ml-0.5">
              <button
                type="button"
                onClick={() => handleMarkerClick(seg.id, markerId)}
                className="rounded px-0.5 text-[var(--accent)] font-semibold hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                aria-label={`Jump to citation ${seg.id}`}
              >
                [{seg.id}]
              </button>
            </sup>
          );
        })}
      </p>

      {citeSegments.length > 0 && (
        <ol className="mt-3 space-y-1.5 border-t border-[var(--border-primary)] pt-2 text-[13px] text-[var(--text-tertiary)] font-[var(--font-body)]">
          {citeSegments.map((seg) => {
            const footId = `cite-${cardId}-${seg.id}`;
            if (seg.quotedText === null) {
              return (
                <li
                  key={footId}
                  id={footId}
                  className="opacity-60"
                  title="No citation was provided for this marker"
                >
                  <span className="mr-1 font-semibold">[{seg.id}]</span>
                  (no citation provided)
                </li>
              );
            }
            if (!seg.verified) {
              return (
                <li
                  key={footId}
                  id={footId}
                  className="opacity-60"
                  title="Quote not found in clause text"
                >
                  <span className="mr-1 font-semibold">[{seg.id}]</span>
                  <span className="italic">&ldquo;{seg.quotedText}&rdquo;</span>
                  <span className="ml-1">&#9888;</span>
                </li>
              );
            }
            return (
              <li key={footId} id={footId} className="flex items-start gap-2">
                <span className="font-semibold">[{seg.id}]</span>
                <span className="italic flex-1">&ldquo;{seg.quotedText}&rdquo;</span>
                {isOriginWithinThisCard && (
                  <button
                    type="button"
                    onClick={handleReturn}
                    className="rounded px-1 text-[var(--accent)] hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    aria-label="Return to marker"
                    title="Return to where you were"
                  >
                    &#8617;
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
