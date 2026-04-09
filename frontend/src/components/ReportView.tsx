/** Full report view — summary bar, top risks, clause cards, export buttons. */

"use client";

import { useState } from "react";
import type { AnalyzeResponse } from "@/types";
import { ClauseCard } from "@/components/ClauseCard";
import { downloadMarkdown, downloadPdf } from "@/lib/export";

interface ReportViewProps {
  data: AnalyzeResponse;
  onReset: () => void;
}

export function ReportView({ data, onReset }: ReportViewProps) {
  const [exporting, setExporting] = useState(false);
  const { summary, clauses } = data;

  const handlePdfExport = async () => {
    setExporting(true);
    try {
      await downloadPdf(data);
    } catch {
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-3xl font-bold text-red-600">
            {summary.risk_breakdown.high}
          </p>
          <p className="text-xs text-red-500">High Risk</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">
            {summary.risk_breakdown.medium}
          </p>
          <p className="text-xs text-yellow-500">Medium Risk</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-3xl font-bold text-green-600">
            {summary.risk_breakdown.low}
          </p>
          <p className="text-xs text-green-500">Low Risk</p>
        </div>
      </div>

      {/* Top risks callout */}
      {summary.top_risks.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase text-red-600">
            Top Risks
          </p>
          <ul className="text-sm text-gray-700">
            {summary.top_risks.map((risk, i) => (
              <li key={i}>• {risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Clause cards */}
      <div className="space-y-3">
        {clauses.map((clause, i) => (
          <ClauseCard key={i} clause={clause} />
        ))}
      </div>

      {/* Export bar */}
      <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadMarkdown(data)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Export Markdown
          </button>
          <button
            type="button"
            onClick={handlePdfExport}
            disabled={exporting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            {exporting ? "Generating..." : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100"
          >
            ← New Contract
          </button>
        </div>
        <span className="text-xs text-gray-400">Not legal advice</span>
      </div>
    </div>
  );
}
