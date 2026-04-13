/** Load a saved analysis and render the full report with chat. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ChatPanel } from "@/components/ChatPanel";
import { ReportView } from "@/components/ReportView";
import { getAnalysis } from "@/lib/api";
import type { AnalyzedClause, AnalyzeResponse, SavedAnalysis } from "@/types";

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [analysis, setAnalysis] = useState<SavedAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState<string | null>(null);

  /** Fetch the saved analysis from the backend. */
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/history");
      return;
    }

    getAnalysis(id)
      .then(setAnalysis)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setIsLoading(false));
  }, [id, isAuthenticated, authLoading, router]);

  const handleReset = useCallback(() => {
    router.push("/");
  }, [router]);

  /** Open chat with a pre-populated question about a specific clause. */
  const handleAskAboutClause = useCallback((clause: AnalyzedClause) => {
    setChatQuestion(
      `What are the risks of the "${clause.title}" clause, and how could I negotiate better terms?`,
    );
    setChatOpen(true);
  }, []);

  // Loading
  if (isLoading || authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
      </main>
    );
  }

  // Error or not found
  if (error || !analysis) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="mb-2 text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
          Analysis not found
        </h1>
        <p className="mb-6 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          {error ?? "This analysis may have been deleted."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/history")}
          className="text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
        >
          Back to history
        </button>
      </main>
    );
  }

  // Reconstruct AnalyzeResponse from saved data
  const analyzeResponse: AnalyzeResponse = {
    overview: analysis.overview,
    summary: analysis.summary,
    clauses: analysis.clauses,
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      <ReportView
        data={analyzeResponse}
        onReset={handleReset}
        onOpenChat={() => setChatOpen(true)}
        onAskAboutClause={handleAskAboutClause}
      />
      <ChatPanel
        isOpen={chatOpen}
        onToggle={() => setChatOpen((o) => !o)}
        analysis={analyzeResponse}
        initialQuestion={chatQuestion}
        onInitialQuestionConsumed={() => setChatQuestion(null)}
      />
    </main>
  );
}
