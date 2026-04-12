/**
 * Build focused context for the chat endpoint by selecting the most
 * relevant clauses based on keyword overlap with the user's question.
 *
 * Replaces the naive "send entire contract + full JSON" approach with
 * a token-efficient selection of overview + summary + top-5 clauses.
 */

import type { AnalyzedClause, AnalyzeResponse, ContractOverview, AnalysisSummary } from "@/types";

export interface ChatContext {
  overview: ContractOverview;
  summary: AnalysisSummary;
  relevantClauses: AnalyzedClause[];
}

/** Tokenize a string into lowercase words, stripping punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Score a clause against the question by keyword overlap. */
function scoreClause(clause: AnalyzedClause, questionTokens: Set<string>): number {
  const clauseText = [
    clause.title,
    clause.category.replace(/_/g, " "),
    clause.plain_english,
    clause.risk_explanation,
    clause.clause_text,
  ].join(" ");

  const clauseTokens = tokenize(clauseText);
  let score = 0;
  for (const token of clauseTokens) {
    if (questionTokens.has(token)) score++;
  }
  return score;
}

/**
 * Select the most relevant clauses for a chat question.
 *
 * Always returns overview + summary. Returns up to 5 clauses ranked
 * by keyword overlap with the question. If there are 5 or fewer total
 * clauses, returns all of them.
 */
export function buildChatContext(
  question: string,
  analysis: AnalyzeResponse,
): ChatContext {
  const MAX_CLAUSES = 5;

  if (analysis.clauses.length <= MAX_CLAUSES) {
    return {
      overview: analysis.overview,
      summary: analysis.summary,
      relevantClauses: analysis.clauses,
    };
  }

  const questionTokens = new Set(tokenize(question));

  const scored = analysis.clauses
    .map((clause) => ({ clause, score: scoreClause(clause, questionTokens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CLAUSES)
    .map((s) => s.clause);

  return {
    overview: analysis.overview,
    summary: analysis.summary,
    relevantClauses: scored,
  };
}
