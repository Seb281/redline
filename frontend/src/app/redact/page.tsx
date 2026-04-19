/**
 * /redact route — standalone PDF redaction entry point.
 *
 * Delegates rendering to RedactExportFlowClient, a "use client" wrapper
 * that loads RedactExportFlow with `ssr: false`. This prevents pdfjs-dist
 * from running on the server (it touches DOMMatrix at module load time).
 *
 * Header and Footer come from the root layout (layout.tsx).
 */

import { RedactExportFlowClient } from "@/components/RedactExportFlowClient";

export default function RedactPage() {
  return <RedactExportFlowClient />;
}
