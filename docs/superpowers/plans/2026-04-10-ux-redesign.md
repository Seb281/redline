# UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Redline frontend from a functional prototype to a clean, professional SaaS tool with dark mode, refined components, filter/sort controls, and polished interactions.

**Architecture:** CSS variable-based theming for dark mode (Tailwind v4 `@theme` + `@custom-variant`), persistent header with theme toggle, component-level reskin preserving existing state machine and data flow. No new dependencies — pure Tailwind + React.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Inter font

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/app/globals.css` | Dark/light theme CSS variables, transitions, custom utilities |
| Create | `frontend/src/components/Header.tsx` | Persistent header with wordmark + dark mode toggle |
| Create | `frontend/src/hooks/useTheme.ts` | Dark mode state management (localStorage + system preference) |
| Modify | `frontend/src/app/layout.tsx` | Add Header, wire theme class to `<html>` |
| Modify | `frontend/src/components/FileUpload.tsx` | Refined drop zone, SVG icon, progress bar |
| Modify | `frontend/src/components/TextPreview.tsx` | Info bar, line numbers, Think Hard tooltip |
| Modify | `frontend/src/app/page.tsx` | Multi-step analyzing state, responsive container |
| Create | `frontend/src/components/RiskChart.tsx` | Mini donut/ring chart for risk distribution |
| Create | `frontend/src/components/ClauseFilters.tsx` | Filter by risk level + category, sort controls |
| Modify | `frontend/src/components/ReportView.tsx` | Integrate chart, filters, sticky export bar, refined cards |
| Modify | `frontend/src/components/ClauseCard.tsx` | Typography, animations, dark mode colors |
| Modify | `frontend/src/components/ContractOverview.tsx` | Dark mode colors |
| Modify | `frontend/src/components/UnusualClausesCallout.tsx` | Dark mode colors |
| Modify | `frontend/src/components/RiskBadge.tsx` | Dark mode colors |
| Modify | `frontend/src/components/Disclaimer.tsx` | Dark mode colors |

---

### Task 1: Dark Mode Theme Foundation

**Files:**
- Modify: `frontend/src/app/globals.css`
- Create: `frontend/src/hooks/useTheme.ts`

- [ ] **Step 1: Set up CSS variables and dark mode in globals.css**

Replace the contents of `frontend/src/app/globals.css` with:

```css
@import "tailwindcss";

/* --- Theme tokens --- */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --bg-card: #ffffff;
  --border-primary: #e5e7eb;
  --border-secondary: #d1d5db;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-tertiary: #6b7280;
  --text-muted: #9ca3af;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
}

.dark {
  --bg-primary: #0f1117;
  --bg-secondary: #1a1d27;
  --bg-tertiary: #242734;
  --bg-card: #1a1d27;
  --border-primary: #2e3140;
  --border-secondary: #3b3f51;
  --text-primary: #f1f2f4;
  --text-secondary: #b0b4c0;
  --text-tertiary: #8b90a0;
  --text-muted: #5f6477;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
}

@theme inline {
  --color-background: var(--bg-primary);
  --color-foreground: var(--text-primary);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@custom-variant dark (&:where(.dark, .dark *));

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: Arial, Helvetica, sans-serif;
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Smooth transitions for theme-aware elements */
.theme-transition {
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
```

- [ ] **Step 2: Create useTheme hook**

Create `frontend/src/hooks/useTheme.ts`:

```typescript
/** Dark mode state management with localStorage persistence and system preference detection. */

"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Manages dark/light theme, persists to localStorage, respects system preference as default. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("redline-theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
      document.documentElement.classList.toggle("dark", stored === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setThemeState(initial);
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem("redline-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return { theme, toggle } as const;
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/app/globals.css src/hooks/useTheme.ts
git commit -m "feat: add dark mode CSS variables and useTheme hook"
```

---

### Task 2: Header Component and Layout Integration

**Files:**
- Create: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Create Header component**

Create `frontend/src/components/Header.tsx`:

```tsx
/** Persistent header with Redline wordmark and dark mode toggle. */

"use client";

import { useTheme } from "@/hooks/useTheme";

/** Top bar shown on every screen. */
export function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
          Redline
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          className="rounded-md p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          {theme === "light" ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update layout.tsx**

Replace `frontend/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Redline — AI Contract Analyzer",
  description: "Upload a contract. Understand what you're signing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased theme-transition`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Remove duplicate header from page.tsx**

In `frontend/src/app/page.tsx`, remove the `<header>` block (lines 60-65) since the title is now in the persistent Header. Replace it with a subtitle-only section:

Replace:
```tsx
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Redline</h1>
        <p className="mt-1 text-gray-500">
          Upload a contract. Understand what you&apos;re signing.
        </p>
      </header>
```

With:
```tsx
      <p className="mb-10 text-center text-sm text-[var(--text-tertiary)]">
        Upload a contract. Understand what you&apos;re signing.
      </p>
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/Header.tsx src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add persistent header with dark mode toggle"
```

---

### Task 3: Redesign Upload Screen

**Files:**
- Modify: `frontend/src/components/FileUpload.tsx`

- [ ] **Step 1: Replace FileUpload component**

Replace the entire contents of `frontend/src/components/FileUpload.tsx` with:

```tsx
/** Drag-and-drop file upload zone for contract documents. */

"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
  error: string | null;
}

/** Upload zone with drag-and-drop, file picker, and upload progress. */
export function FileUpload({
  onFileSelected,
  isUploading,
  error,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return;
      }
      if (file.size > MAX_SIZE) {
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  return (
    <div className="flex flex-col items-center">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full max-w-lg rounded-xl border-2 border-dashed px-10 py-16 text-center transition-all duration-200 ${
          isDragging
            ? "border-[var(--accent)] bg-blue-50 dark:bg-blue-950/30"
            : "border-[var(--border-secondary)] bg-[var(--bg-card)] shadow-sm hover:border-[var(--text-muted)] hover:shadow-md"
        }`}
      >
        {/* Document icon (SVG) */}
        <div className="mb-4 flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <p className="mb-1 text-lg font-semibold text-[var(--text-primary)]">
          Drop your contract here
        </p>
        <p className="mb-5 text-sm text-[var(--text-tertiary)]">
          PDF or DOCX — up to 10 MB
        </p>

        {/* File type pills */}
        <div className="mb-5 flex justify-center gap-2">
          <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-tertiary)]">
            .pdf
          </span>
          <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-tertiary)]">
            .docx
          </span>
        </div>

        {isUploading ? (
          <div className="mx-auto w-48">
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div className="h-full animate-pulse rounded-full bg-[var(--accent)]" style={{ width: "60%" }} />
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Uploading...</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-[var(--text-primary)] px-6 py-2.5 text-sm font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-80"
          >
            Browse files
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/FileUpload.tsx
git commit -m "feat: redesign upload screen with SVG icon and progress bar"
```

---

### Task 4: Redesign Preview Screen

**Files:**
- Modify: `frontend/src/components/TextPreview.tsx`

- [ ] **Step 1: Replace TextPreview component**

Replace the entire contents of `frontend/src/components/TextPreview.tsx` with:

```tsx
/** Extracted text preview with Analyze button and Think Hard toggle. */

"use client";

import { useState } from "react";
import type { UploadResponse } from "@/types";

interface TextPreviewProps {
  data: UploadResponse;
  onAnalyze: (thinkHard: boolean) => void;
  onReset: () => void;
  isAnalyzing: boolean;
}

/** Preview of extracted contract text with analysis controls. */
export function TextPreview({
  data,
  onAnalyze,
  onReset,
  isAnalyzing,
}: TextPreviewProps) {
  const [thinkHard, setThinkHard] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      {/* File info bar */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3 theme-transition">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-muted)]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{data.filename}</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {data.page_count} {data.page_count === 1 ? "page" : "pages"} · {data.char_count.toLocaleString()} chars
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          Change file
        </button>
      </div>

      {/* Text preview with line numbers */}
      <div className="mb-6 max-h-72 overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] theme-transition">
        <pre className="p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          {data.extracted_text.split("\n").map((line, i) => (
            <div key={i} className="flex">
              <span className="mr-4 inline-block w-8 shrink-0 text-right text-xs text-[var(--text-muted)] select-none">
                {i + 1}
              </span>
              <span>{line || "\u00A0"}</span>
            </div>
          ))}
        </pre>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onAnalyze(thinkHard)}
          disabled={isAnalyzing}
          className="rounded-lg bg-[var(--accent)] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Contract"}
        </button>

        <div className="group relative">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <button
              type="button"
              role="switch"
              aria-checked={thinkHard}
              onClick={() => setThinkHard(!thinkHard)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                thinkHard ? "bg-[var(--accent)]" : "bg-[var(--border-secondary)]"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  thinkHard ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            Think Hard
          </label>
          {/* Tooltip */}
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs text-[var(--bg-primary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Analyzes each clause individually for deeper insight
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/TextPreview.tsx
git commit -m "feat: redesign preview screen with line numbers and tooltip"
```

---

### Task 5: Multi-Step Analyzing State

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Update the analyzing view in page.tsx**

In `frontend/src/app/page.tsx`, replace the analyzing state block:

```tsx
      {state.view === "analyzing" && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p className="text-gray-500">Analyzing clauses...</p>
        </div>
      )}
```

With:

```tsx
      {state.view === "analyzing" && (
        <div className="flex flex-col items-center justify-center py-20">
          {/* Spinner */}
          <div className="mb-6 h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--border-primary)] border-t-[var(--accent)]" />

          {/* Multi-step progress */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">Extracting clauses...</p>
            </div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="h-2 w-2 rounded-full bg-[var(--border-secondary)]" />
              <p className="text-sm text-[var(--text-tertiary)]">Analyzing risk...</p>
            </div>
          </div>

          {/* Skeleton cards */}
          <div className="mt-10 w-full max-w-2xl space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"
              >
                <div className="mb-3 flex gap-2">
                  <div className="h-5 w-16 rounded bg-[var(--bg-tertiary)]" />
                  <div className="h-5 w-24 rounded bg-[var(--bg-tertiary)]" />
                </div>
                <div className="mb-2 h-4 w-48 rounded bg-[var(--bg-tertiary)]" />
                <div className="h-3 w-full rounded bg-[var(--bg-tertiary)]" />
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Update the main container styling**

In the same file, update the `<main>` tag classes from:

```tsx
    <main className="mx-auto max-w-4xl px-4 py-12">
```

To:

```tsx
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/app/page.tsx
git commit -m "feat: add multi-step analyzing state with skeleton cards"
```

---

### Task 6: Risk Distribution Chart

**Files:**
- Create: `frontend/src/components/RiskChart.tsx`

- [ ] **Step 1: Create RiskChart component**

Create `frontend/src/components/RiskChart.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/RiskChart.tsx
git commit -m "feat: add risk distribution donut chart component"
```

---

### Task 7: Clause Filter and Sort Controls

**Files:**
- Create: `frontend/src/components/ClauseFilters.tsx`

- [ ] **Step 1: Create ClauseFilters component**

Create `frontend/src/components/ClauseFilters.tsx`:

```tsx
/** Filter and sort controls for clause list. */

"use client";

import type { ClauseCategory, RiskLevel } from "@/types";

export type SortOption = "risk-desc" | "risk-asc" | "category";

interface ClauseFiltersProps {
  riskFilter: RiskLevel | "all";
  categoryFilter: ClauseCategory | "all";
  sort: SortOption;
  onRiskFilterChange: (value: RiskLevel | "all") => void;
  onCategoryFilterChange: (value: ClauseCategory | "all") => void;
  onSortChange: (value: SortOption) => void;
  totalCount: number;
  filteredCount: number;
}

const RISK_OPTIONS: { value: RiskLevel | "all"; label: string }[] = [
  { value: "all", label: "All risks" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS: { value: ClauseCategory | "all"; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "non_compete", label: "Non-Compete" },
  { value: "liability", label: "Liability" },
  { value: "termination", label: "Termination" },
  { value: "ip_assignment", label: "IP Assignment" },
  { value: "confidentiality", label: "Confidentiality" },
  { value: "governing_law", label: "Governing Law" },
  { value: "indemnification", label: "Indemnification" },
  { value: "data_protection", label: "Data Protection" },
  { value: "payment_terms", label: "Payment Terms" },
  { value: "limitation_of_liability", label: "Limitation of Liability" },
  { value: "force_majeure", label: "Force Majeure" },
  { value: "dispute_resolution", label: "Dispute Resolution" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "risk-desc", label: "Risk: High → Low" },
  { value: "risk-asc", label: "Risk: Low → High" },
  { value: "category", label: "Category" },
];

const selectClasses =
  "rounded-md border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-secondary)] theme-transition focus:border-[var(--accent)] focus:outline-none";

/** Filter bar above clause cards. */
export function ClauseFilters({
  riskFilter,
  categoryFilter,
  sort,
  onRiskFilterChange,
  onCategoryFilterChange,
  onSortChange,
  totalCount,
  filteredCount,
}: ClauseFiltersProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <select
        value={riskFilter}
        onChange={(e) => onRiskFilterChange(e.target.value as RiskLevel | "all")}
        className={selectClasses}
      >
        {RISK_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value as ClauseCategory | "all")}
        className={selectClasses}
      >
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className={selectClasses}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {filteredCount !== totalCount && (
        <span className="text-xs text-[var(--text-muted)]">
          {filteredCount} of {totalCount} clauses
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/ClauseFilters.tsx
git commit -m "feat: add clause filter and sort controls component"
```

---

### Task 8: Redesign ReportView

**Files:**
- Modify: `frontend/src/components/ReportView.tsx`

- [ ] **Step 1: Replace ReportView with redesigned version**

Replace the entire contents of `frontend/src/components/ReportView.tsx` with:

```tsx
/** Full report view — overview, risk summary, filters, clause cards, sticky export bar. */

"use client";

import { useMemo, useState } from "react";
import type { AnalyzedClause, AnalyzeResponse, ClauseCategory, RiskLevel } from "@/types";
import { ClauseCard } from "@/components/ClauseCard";
import { ClauseFilters, type SortOption } from "@/components/ClauseFilters";
import { ContractOverview } from "@/components/ContractOverview";
import { RiskChart } from "@/components/RiskChart";
import { UnusualClausesCallout } from "@/components/UnusualClausesCallout";
import { downloadMarkdown, downloadPdf } from "@/lib/export";

interface ReportViewProps {
  data: AnalyzeResponse;
  onReset: () => void;
}

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** Applies filters and sorting to clause list. */
function useFilteredClauses(
  clauses: AnalyzedClause[],
  riskFilter: RiskLevel | "all",
  categoryFilter: ClauseCategory | "all",
  sort: SortOption
) {
  return useMemo(() => {
    let result = clauses;

    if (riskFilter !== "all") {
      result = result.filter((c) => c.risk_level === riskFilter);
    }
    if (categoryFilter !== "all") {
      result = result.filter((c) => c.category === categoryFilter);
    }

    return [...result].sort((a, b) => {
      if (sort === "risk-desc") return RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level];
      if (sort === "risk-asc") return RISK_ORDER[b.risk_level] - RISK_ORDER[a.risk_level];
      return a.category.localeCompare(b.category);
    });
  }, [clauses, riskFilter, categoryFilter, sort]);
}

/** Full analysis report with overview, summary, filters, clause cards, and export bar. */
export function ReportView({ data, onReset }: ReportViewProps) {
  const [exporting, setExporting] = useState(false);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ClauseCategory | "all">("all");
  const [sort, setSort] = useState<SortOption>("risk-desc");

  const { summary, clauses } = data;
  const filteredClauses = useFilteredClauses(clauses, riskFilter, categoryFilter, sort);

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
    <div className="pb-20">
      {/* Contract overview */}
      <ContractOverview overview={data.overview} />

      {/* Risk summary — cards + chart */}
      <div className="mb-6 flex gap-4">
        <div className="grid flex-1 grid-cols-3 gap-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950/40">
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {summary.risk_breakdown.high}
            </p>
            <p className="text-xs text-red-500 dark:text-red-400/70">High Risk</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-900 dark:bg-yellow-950/40">
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {summary.risk_breakdown.medium}
            </p>
            <p className="text-xs text-yellow-500 dark:text-yellow-400/70">Medium Risk</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950/40">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {summary.risk_breakdown.low}
            </p>
            <p className="text-xs text-green-500 dark:text-green-400/70">Low Risk</p>
          </div>
        </div>
        <RiskChart breakdown={summary.risk_breakdown} />
      </div>

      {/* Top risks callout */}
      {summary.top_risks.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
          <p className="mb-1 text-xs font-semibold uppercase text-red-600 dark:text-red-400">
            Top Risks
          </p>
          <ul className="text-sm text-[var(--text-secondary)]">
            {summary.top_risks.map((risk, i) => (
              <li key={i}>• {risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Unusual clauses */}
      <UnusualClausesCallout clauses={clauses} />

      {/* Filters */}
      <ClauseFilters
        riskFilter={riskFilter}
        categoryFilter={categoryFilter}
        sort={sort}
        onRiskFilterChange={setRiskFilter}
        onCategoryFilterChange={setCategoryFilter}
        onSortChange={setSort}
        totalCount={clauses.length}
        filteredCount={filteredClauses.length}
      />

      {/* Clause cards */}
      <div className="space-y-3">
        {filteredClauses.map((clause, i) => (
          <ClauseCard key={i} clause={clause} />
        ))}
        {filteredClauses.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            No clauses match the current filters.
          </p>
        )}
      </div>

      {/* Sticky export bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadMarkdown(data)}
              className="rounded-md border border-[var(--border-primary)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              Export Markdown
            </button>
            <button
              type="button"
              onClick={handlePdfExport}
              disabled={exporting}
              className="rounded-md border border-[var(--border-primary)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            >
              {exporting ? "Generating..." : "Export PDF"}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-md px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
            >
              New Contract
            </button>
          </div>
          <span className="text-xs text-[var(--text-muted)]">Not legal advice</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/ReportView.tsx
git commit -m "feat: redesign report view with chart, filters, and sticky export bar"
```

---

### Task 9: Dark Mode for Remaining Components

**Files:**
- Modify: `frontend/src/components/ClauseCard.tsx`
- Modify: `frontend/src/components/ContractOverview.tsx`
- Modify: `frontend/src/components/UnusualClausesCallout.tsx`
- Modify: `frontend/src/components/RiskBadge.tsx`
- Modify: `frontend/src/components/Disclaimer.tsx`

- [ ] **Step 1: Update ClauseCard.tsx**

In `frontend/src/components/ClauseCard.tsx`, update the hardcoded colors to use CSS variables:

Replace the outer `div` className:
```tsx
      className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 ${BORDER_COLORS[clause.risk_level]}`}
```
With:
```tsx
      className={`rounded-lg border border-[var(--border-primary)] border-l-4 bg-[var(--bg-card)] p-4 theme-transition ${BORDER_COLORS[clause.risk_level]}`}
```

Replace category span className:
```tsx
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
```
With:
```tsx
        <span className="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
```

Replace title `h3` className:
```tsx
      <h3 className="mb-1 text-sm font-semibold text-gray-800">
```
With:
```tsx
      <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
```

Replace plain_english `p` className:
```tsx
      <p className="text-sm leading-relaxed text-gray-600">
```
With:
```tsx
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
```

Replace expanded details div className:
```tsx
        <div className="mt-3 rounded-md bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
```
With:
```tsx
        <div className="mt-3 rounded-md bg-[var(--bg-secondary)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
```

Replace original clause summary className:
```tsx
            <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
```
With:
```tsx
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
```

Replace original clause text className:
```tsx
            <p className="mt-1 whitespace-pre-wrap font-mono text-gray-500">
```
With:
```tsx
            <p className="mt-1 whitespace-pre-wrap font-mono text-[var(--text-tertiary)]">
```

- [ ] **Step 2: Update ContractOverview.tsx**

In `frontend/src/components/ContractOverview.tsx`, update the wrapper div:
```tsx
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
```
To:
```tsx
    <div className="mb-6 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5 theme-transition">
```

Update `h2`:
```tsx
      <h2 className="mb-1 text-lg font-semibold text-gray-800">
```
To:
```tsx
      <h2 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">
```

Update parties `p`:
```tsx
      <p className="mb-3 text-sm text-gray-500">
```
To:
```tsx
      <p className="mb-3 text-sm text-[var(--text-tertiary)]">
```

Update details `p`:
```tsx
        <p className="mb-3 text-sm text-gray-600">
```
To:
```tsx
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
```

Update "Key Terms" label:
```tsx
        <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
```
To:
```tsx
        <p className="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">
```

Update key terms list:
```tsx
        <ul className="space-y-1 text-sm text-gray-600">
```
To:
```tsx
        <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
```

- [ ] **Step 3: Update UnusualClausesCallout.tsx**

In `frontend/src/components/UnusualClausesCallout.tsx`, update:
```tsx
    <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
```
To:
```tsx
    <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-900 dark:bg-purple-950/30">
```

Update the list text color:
```tsx
      <ul className="text-sm text-gray-700">
```
To:
```tsx
      <ul className="text-sm text-[var(--text-secondary)]">
```

Update the explanation span:
```tsx
              <span className="text-gray-500">
```
To:
```tsx
              <span className="text-[var(--text-tertiary)]">
```

- [ ] **Step 4: Update RiskBadge.tsx**

In `frontend/src/components/RiskBadge.tsx`, update the STYLES to include dark mode:
```tsx
const STYLES: Record<RiskLevel, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};
```
To:
```tsx
const STYLES: Record<RiskLevel, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400",
  low: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
};
```

- [ ] **Step 5: Update Disclaimer.tsx**

Replace the entire `Disclaimer` component:
```tsx
export function Disclaimer() {
  return (
    <div className="mt-8 mx-auto max-w-2xl border-l-[3px] border-gray-400 bg-gray-50 px-4 py-3 text-sm text-gray-500">
      This tool provides analysis only — not legal advice. Consult a qualified
      lawyer before making legal decisions.
    </div>
  );
}
```
With:
```tsx
/** Legal disclaimer banner — displayed on every screen. */

export function Disclaimer() {
  return (
    <div className="mt-8 mx-auto max-w-2xl border-l-[3px] border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-tertiary)] theme-transition">
      This tool provides analysis only — not legal advice. Consult a qualified
      lawyer before making legal decisions.
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/components/ClauseCard.tsx src/components/ContractOverview.tsx src/components/UnusualClausesCallout.tsx src/components/RiskBadge.tsx src/components/Disclaimer.tsx
git commit -m "feat: add dark mode support to all remaining components"
```

---

### Task 10: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run frontend build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 2: Run frontend linter**

Run: `cd frontend && pnpm lint`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run backend tests (regression check)**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/test_schemas.py tests/test_analyzer.py tests/test_parser.py -v`
Expected: All PASS (backend unchanged in this track)

- [ ] **Step 4: Commit lint fixes if needed**

```bash
git add -A
git commit -m "chore: lint fixes for UX redesign"
```
