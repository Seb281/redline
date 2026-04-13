/** Saved analyses list — shows login prompt if unauthenticated. */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { LoginPrompt } from "@/components/LoginPrompt";
import { deleteAnalysis, listAnalyses } from "@/lib/api";
import type { AnalysisListItem } from "@/types";

export default function HistoryPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch analyses when authenticated. */
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    listAnalyses()
      .then(setAnalyses)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setHasFetched(true));
  }, [isAuthenticated, authLoading]);

  /** Derived loading — true while authenticated but fetch hasn't completed. */
  const isLoading = isAuthenticated && !authLoading && !hasFetched;

  /** Delete an analysis with confirmation. */
  const handleDelete = useCallback(
    async (id: string, filename: string) => {
      if (!confirm(`Delete analysis of "${filename}"?`)) return;

      try {
        await deleteAnalysis(id);
        setAnalyses((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [],
  );

  // Auth loading
  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
      </main>
    );
  }

  // Not authenticated — show login prompt
  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="mb-2 text-center text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
          Your Analyses
        </h1>
        <p className="mb-6 text-center text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          Log in to save and revisit your analyses
        </p>
        <LoginPrompt />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      <h1 className="mb-6 text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
        Your Analyses
      </h1>

      {/* Loading */}
      {isLoading && (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <p className="py-12 text-center text-[15px] text-[var(--accent)] font-[var(--font-body)]">
          {error}
        </p>
      )}

      {/* Empty state */}
      {!isLoading && !error && analyses.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-[17px] text-[var(--text-muted)] font-[var(--font-body)]">
            No saved analyses yet
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
          >
            Analyze a contract
          </Link>
        </div>
      )}

      {/* Analysis list */}
      {!isLoading && !error && analyses.length > 0 && (
        <div className="space-y-3">
          {analyses.map((analysis) => (
            <div
              key={analysis.id}
              className="flex items-center justify-between rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-secondary)] theme-transition"
            >
              <Link
                href={`/history/${analysis.id}`}
                className="flex-1 no-underline"
              >
                <p className="text-[15px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">
                  {analysis.filename}
                </p>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
                  {analysis.contract_type && (
                    <span>{analysis.contract_type}</span>
                  )}
                  <span>
                    {new Date(analysis.created_at).toLocaleDateString()}
                  </span>
                  <span>{analysis.clause_count} clauses</span>
                  <span className="capitalize">{analysis.analysis_mode}</span>
                </div>
              </Link>

              <div className="flex items-center gap-3">
                {/* Risk counts */}
                <div className="flex gap-2 text-sm font-medium font-[var(--font-body)]">
                  {analysis.risk_high > 0 && (
                    <span className="text-[var(--risk-high)]">
                      {analysis.risk_high}H
                    </span>
                  )}
                  {analysis.risk_medium > 0 && (
                    <span className="text-[var(--risk-medium)]">
                      {analysis.risk_medium}M
                    </span>
                  )}
                  {analysis.risk_low > 0 && (
                    <span className="text-[var(--risk-low)]">
                      {analysis.risk_low}L
                    </span>
                  )}
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() =>
                    handleDelete(analysis.id, analysis.filename)
                  }
                  className="rounded p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]"
                  aria-label="Delete analysis"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
