/**
 * Tests for RedactExportFlow and sub-components.
 *
 * WHY we test sub-components directly in addition to the flow:
 * RedactExportFlow is an orchestrator that delegates everything to the hook
 * and sub-components. The interesting logic lives in:
 *   - RedactPreviewPanel: kind-level toggle state
 *   - RedactModeToggle: disabled state propagation
 *   - RedactDownloadCard: skipped-match banner gating (privacy-critical)
 *
 * We mock `useRedactExport` to drive state transitions without real pdfjs /
 * pdf-lib execution — those are covered in the lib-level tests.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RedactModeToggle } from "./RedactModeToggle";
import { RedactPreviewPanel } from "./RedactPreviewPanel";
import { RedactDownloadCard } from "./RedactDownloadCard";
import type { TokenRange, SkippedMatch } from "@/lib/redact-export/types";

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before any imports that pull in the
// mocked modules. vi.mock() is hoisted to the top of the file by vitest.
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useRedactExport", () => ({
  useRedactExport: vi.fn(),
}));

vi.mock("@/lib/redact-export", () => ({
  registerPdfWorker: vi.fn(),
  SENSITIVE_KINDS: new Set(["PERSON", "ORG", "EMAIL", "IBAN"]),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToken(
  kind: TokenRange["kind"],
  label: string,
  original: string,
): TokenRange {
  return { start: 0, end: original.length, original, kind, label };
}

function makeSensitiveBlob(): Blob {
  return new Blob(["PDF"], { type: "application/pdf" });
}

// ---------------------------------------------------------------------------
// RedactModeToggle
// ---------------------------------------------------------------------------

describe("RedactModeToggle", () => {
  afterEach(cleanup);

  it("renders Quick and Smart buttons", () => {
    render(
      <RedactModeToggle mode="quick" onChange={vi.fn()} />,
    );
    expect(screen.getByText("Quick")).toBeTruthy();
    expect(screen.getByText("Smart")).toBeTruthy();
  });

  it("calls onChange with 'smart' when Smart clicked", () => {
    const onChange = vi.fn();
    render(<RedactModeToggle mode="quick" onChange={onChange} />);
    fireEvent.click(screen.getByText("Smart"));
    expect(onChange).toHaveBeenCalledWith("smart");
  });

  it("calls onChange with 'quick' when Quick clicked in Smart mode", () => {
    const onChange = vi.fn();
    render(<RedactModeToggle mode="smart" onChange={onChange} />);
    fireEvent.click(screen.getByText("Quick"));
    expect(onChange).toHaveBeenCalledWith("quick");
  });

  it("shows AI description when Smart selected", () => {
    render(<RedactModeToggle mode="smart" onChange={vi.fn()} />);
    expect(
      screen.getByText(/scrubbed text sent to Mistral/i),
    ).toBeTruthy();
  });

  it("disables buttons when disabled prop is true", () => {
    render(
      <RedactModeToggle mode="quick" onChange={vi.fn()} disabled={true} />,
    );
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// RedactPreviewPanel
// ---------------------------------------------------------------------------

describe("RedactPreviewPanel", () => {
  afterEach(cleanup);

  const tokens: TokenRange[] = [
    makeToken("EMAIL", "Email 1", "alice@example.com"),
    makeToken("PERSON", "Person 1", "Alice Smith"),
    makeToken("DATE", "Date 1", "2026-01-01"),
  ];
  const fullText =
    "Alice Smith signed alice@example.com on 2026-01-01";

  it("renders all kind labels", () => {
    render(
      <RedactPreviewPanel
        tokens={tokens}
        fullText={fullText}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/email addresses/i)).toBeTruthy();
    expect(screen.getByText(/people/i)).toBeTruthy();
    expect(screen.getByText(/dates/i)).toBeTruthy();
  });

  it("calls onConfirm with empty disabled set when nothing toggled", () => {
    const onConfirm = vi.fn();
    render(
      <RedactPreviewPanel
        tokens={tokens}
        fullText={fullText}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/Redact → Build PDF/i));
    expect(onConfirm).toHaveBeenCalledWith(new Set());
  });

  it("includes kind in disabled set when toggled off", () => {
    const onConfirm = vi.fn();
    render(
      <RedactPreviewPanel
        tokens={tokens}
        fullText={fullText}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    // Click the EMAIL kind button to disable it.
    // The button wraps "Email addresses" label — find by button role.
    const kindButtons = screen.getAllByRole("button", { hidden: false });
    // Find the one that contains "Email addresses" text.
    const emailBtn = kindButtons.find(
      (b) => b.textContent?.toLowerCase().includes("email"),
    );
    expect(emailBtn).toBeTruthy();
    fireEvent.click(emailBtn!);
    fireEvent.click(screen.getByText(/Redact → Build PDF/i));
    const arg = onConfirm.mock.calls[0][0] as Set<string>;
    expect(arg.has("EMAIL")).toBe(true);
  });

  it("calls onCancel when Cancel clicked", () => {
    const onCancel = vi.fn();
    render(
      <RedactPreviewPanel
        tokens={tokens}
        fullText={fullText}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows no-entities message when tokens is empty", () => {
    render(
      <RedactPreviewPanel
        tokens={[]}
        fullText="nothing here"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/no sensitive entities detected/i),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// RedactDownloadCard — skipped-match banner gating (privacy-critical)
// ---------------------------------------------------------------------------

describe("RedactDownloadCard – download gating", () => {
  afterEach(cleanup);

  const baseProps = {
    blob: makeSensitiveBlob(),
    filename: "contract-redacted.pdf",
    matchesByKind: {
      PERSON: 2,
      ORG: 1,
      EMAIL: 3,
      PHONE: 0,
      IBAN: 0,
      ADDRESS: 0,
      POSTCODE: 0,
      DATE: 0,
      MONEY: 0,
      OTHER: 0,
    } as Record<TokenRange["kind"], number>,
    skipped: [] as SkippedMatch[],
    smartFallbackNotice: false,
    onStartOver: vi.fn(),
  };

  it("renders download card and enables download when no skips", () => {
    render(<RedactDownloadCard {...baseProps} />);
    const btn = screen.getByTestId("download-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(screen.queryByTestId("skipped-match-banner")).toBeNull();
  });

  it("shows yellow banner without checkbox when only low-sensitivity kinds skipped", () => {
    const skipped: SkippedMatch[] = [
      { label: "Date 1", kind: "DATE", original: "2026-01-01" },
    ];
    render(<RedactDownloadCard {...baseProps} skipped={skipped} />);
    expect(screen.getByTestId("skipped-match-banner")).toBeTruthy();
    // No checkbox — low sensitivity
    expect(screen.queryByTestId("reviewed-checkbox")).toBeNull();
    // Download should be enabled (no gate)
    const btn = screen.getByTestId("download-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("shows red banner with checkbox and GATES download when sensitive kind skipped", () => {
    const skipped: SkippedMatch[] = [
      { label: "Email 1", kind: "EMAIL", original: "alice@example.com" },
    ];
    render(<RedactDownloadCard {...baseProps} skipped={skipped} />);
    const banner = screen.getByTestId("skipped-match-banner");
    expect(banner).toBeTruthy();
    const checkbox = screen.getByTestId(
      "reviewed-checkbox",
    ) as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    // Download disabled before checkbox checked
    const btn = screen.getByTestId("download-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("unblocks download after user checks the reviewed checkbox", () => {
    const skipped: SkippedMatch[] = [
      { label: "Person 1", kind: "PERSON", original: "Alice Smith" },
    ];
    render(<RedactDownloadCard {...baseProps} skipped={skipped} />);
    const checkbox = screen.getByTestId(
      "reviewed-checkbox",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    const btn = screen.getByTestId("download-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("shows smartFallbackNotice banner when prop is true", () => {
    render(
      <RedactDownloadCard {...baseProps} smartFallbackNotice={true} />,
    );
    expect(
      screen.getByText(/ai role labels were unavailable/i),
    ).toBeTruthy();
  });

  it("lists affected sensitive kinds in banner text", () => {
    const skipped: SkippedMatch[] = [
      { label: "Email 1", kind: "EMAIL", original: "alice@example.com" },
      { label: "IBAN 1", kind: "IBAN", original: "NL91ABNA0417164300" },
    ];
    render(<RedactDownloadCard {...baseProps} skipped={skipped} />);
    const banner = screen.getByTestId("skipped-match-banner");
    expect(banner.textContent?.toLowerCase()).toContain("emails");
    expect(banner.textContent?.toLowerCase()).toContain("iban");
  });
});

// ---------------------------------------------------------------------------
// RedactExportFlow — state transitions via mocked hook
// ---------------------------------------------------------------------------

describe("RedactExportFlow – state transitions", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetModules();
  });

  it("renders upload zone in idle state", async () => {
    const { useRedactExport } = await import("@/hooks/useRedactExport");
    (useRedactExport as ReturnType<typeof vi.fn>).mockReturnValue({
      status: "idle",
      error: null,
      smartFallbackNotice: false,
      preview: null,
      result: null,
      start: vi.fn(),
      confirmPreview: vi.fn(),
      reset: vi.fn(),
    });
    const { RedactExportFlow } = await import("./RedactExportFlow");
    render(<RedactExportFlow />);
    expect(screen.getByText(/Browse files/i)).toBeTruthy();
  });

  it("renders preview panel in awaiting_preview state", async () => {
    const { useRedactExport } = await import("@/hooks/useRedactExport");
    (useRedactExport as ReturnType<typeof vi.fn>).mockReturnValue({
      status: "awaiting_preview",
      error: null,
      smartFallbackNotice: false,
      preview: {
        tokens: [makeToken("EMAIL", "Email 1", "a@b.com")],
        extracted: { fullText: "a@b.com", spans: [], bytes: new ArrayBuffer(0), pageCount: 1 },
      },
      result: null,
      start: vi.fn(),
      confirmPreview: vi.fn(),
      reset: vi.fn(),
    });
    const { RedactExportFlow } = await import("./RedactExportFlow");
    render(<RedactExportFlow />);
    expect(screen.getByTestId("redact-preview-panel")).toBeTruthy();
  });

  it("renders download card in complete state", async () => {
    const { useRedactExport } = await import("@/hooks/useRedactExport");
    (useRedactExport as ReturnType<typeof vi.fn>).mockReturnValue({
      status: "complete",
      error: null,
      smartFallbackNotice: false,
      preview: null,
      result: {
        blob: makeSensitiveBlob(),
        filename: "test-redacted.pdf",
        skipped: [],
        matchesByKind: {
          PERSON: 1, ORG: 0, EMAIL: 0, PHONE: 0, IBAN: 0,
          ADDRESS: 0, POSTCODE: 0, DATE: 0, MONEY: 0, OTHER: 0,
        },
      },
      start: vi.fn(),
      confirmPreview: vi.fn(),
      reset: vi.fn(),
    });
    const { RedactExportFlow } = await import("./RedactExportFlow");
    render(<RedactExportFlow />);
    expect(screen.getByTestId("redact-download-card")).toBeTruthy();
  });

  it("renders error banner in error state", async () => {
    const { useRedactExport } = await import("@/hooks/useRedactExport");
    (useRedactExport as ReturnType<typeof vi.fn>).mockReturnValue({
      status: "error",
      error: { stage: "extract", message: "File corrupted", recoverable: true },
      smartFallbackNotice: false,
      preview: null,
      result: null,
      start: vi.fn(),
      confirmPreview: vi.fn(),
      reset: vi.fn(),
    });
    const { RedactExportFlow } = await import("./RedactExportFlow");
    render(<RedactExportFlow />);
    expect(screen.getByText("File corrupted")).toBeTruthy();
  });
});
