/**
 * Tests the interactive redaction preview shown between Pass 0 and role
 * selection. Verifies: kind grouping + counts, per-entity toggle, confirm
 * callback receives filtered activeTokens map, cancel callback fires.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RedactionPreview } from "./RedactionPreview";

const RAW = "ACME Corp emails dpo@acme.eu and pays NL91 ABNA 0417 1643 00.";
const SCRUBBED =
  "\u27E6PARTY_A\u27E7 emails \u27E6EMAIL_1\u27E7 and pays \u27E6IBAN_1\u27E7.";
const TOKEN_MAP = new Map<string, string>([
  ["\u27E6PARTY_A\u27E7", "ACME Corp"],
  ["\u27E6EMAIL_1\u27E7", "dpo@acme.eu"],
  ["\u27E6IBAN_1\u27E7", "NL91 ABNA 0417 1643 00"],
]);

describe("RedactionPreview", () => {
  afterEach(cleanup);

  it("renders one legend row per kind with correct counts", () => {
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Parties/i)).toBeTruthy();
    expect(screen.getByText(/Emails/i)).toBeTruthy();
    expect(screen.getByText(/IBANs/i)).toBeTruthy();
    expect(screen.getByText(/3 items will be masked/i)).toBeTruthy();
  });

  it("confirm fires with the full map when nothing is toggled off", () => {
    const onConfirm = vi.fn();
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const received = onConfirm.mock.calls[0][0] as Map<string, string>;
    expect(received.size).toBe(3);
  });

  it("toggling an entity off removes it from the confirm payload", () => {
    const onConfirm = vi.fn();
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /emails/i }));
    const emailToggle = screen.getByRole("button", {
      name: /disable dpo@acme\.eu/i,
    });
    fireEvent.click(emailToggle);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    const received = onConfirm.mock.calls[0][0] as Map<string, string>;
    expect(received.has("\u27E6EMAIL_1\u27E7")).toBe(false);
    expect(received.has("\u27E6PARTY_A\u27E7")).toBe(true);
    expect(received.has("\u27E6IBAN_1\u27E7")).toBe(true);
  });

  it("cancel fires the onCancel callback", () => {
    const onCancel = vi.fn();
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("warns when user disables everything", () => {
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /parties/i }));
    fireEvent.click(screen.getByRole("button", { name: /disable acme corp/i }));
    fireEvent.click(screen.getByRole("button", { name: /emails/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /disable dpo@acme\.eu/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /ibans/i }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /disable nl91 abna 0417 1643 00/i,
      }),
    );
    expect(screen.getByText(/No redactions active/i)).toBeTruthy();
  });
});
