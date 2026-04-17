/**
 * Tests the interactive redaction preview shown between Pass 0 and role
 * selection. Verifies: kind grouping + counts, per-entity toggle, confirm
 * callback receives disabled-token set, cancel callback fires.
 *
 * SP-1.9 Phase 6: added editable-labels block tests (Task 6.2).
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

/** Minimal party data matching TOKEN_MAP so the parties block renders. */
const BASE_PARTIES = [{ name: "ACME Corp", role_label: null }];
const BASE_EDITABLE_LABELS = ["PARTY_A"];

describe("RedactionPreview", () => {
  afterEach(cleanup);

  it("renders one legend row per kind with correct counts", () => {
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        parties={BASE_PARTIES}
        editableLabels={BASE_EDITABLE_LABELS}
        onEditLabel={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Parties/i)).toBeTruthy();
    expect(screen.getByText(/Emails/i)).toBeTruthy();
    expect(screen.getByText(/IBANs/i)).toBeTruthy();
    expect(screen.getByText(/3 items will be masked/i)).toBeTruthy();
  });

  it("confirm fires with empty disabled set when nothing is toggled off", () => {
    const onConfirm = vi.fn();
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        parties={BASE_PARTIES}
        editableLabels={BASE_EDITABLE_LABELS}
        onEditLabel={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const received = onConfirm.mock.calls[0][0] as Set<string>;
    // Nothing disabled → disabled set is empty.
    expect(received.size).toBe(0);
  });

  it("toggling an entity off adds it to the disabled set in the confirm payload", () => {
    const onConfirm = vi.fn();
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        parties={BASE_PARTIES}
        editableLabels={BASE_EDITABLE_LABELS}
        onEditLabel={vi.fn()}
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
    const received = onConfirm.mock.calls[0][0] as Set<string>;
    // EMAIL_1 was disabled → present in disabled set.
    expect(received.has("\u27E6EMAIL_1\u27E7")).toBe(true);
    // PARTY_A and IBAN_1 were not disabled → absent from disabled set.
    expect(received.has("\u27E6PARTY_A\u27E7")).toBe(false);
    expect(received.has("\u27E6IBAN_1\u27E7")).toBe(false);
  });

  it("cancel fires the onCancel callback", () => {
    const onCancel = vi.fn();
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        parties={BASE_PARTIES}
        editableLabels={BASE_EDITABLE_LABELS}
        onEditLabel={vi.fn()}
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
        parties={BASE_PARTIES}
        editableLabels={BASE_EDITABLE_LABELS}
        onEditLabel={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // PARTY_A is in the parties block — disable it via the kind-groups
    // fallback by passing no parties so the token lands in kind-groups.
    // Since parties are now in the dedicated block, disable ACME Corp
    // by expanding the parties block label toggle isn't available.
    // Instead, expand Emails and IBANs in the kind-groups block and
    // disable those two (PARTY_A can't be toggled in kind-groups when it's
    // in the parties block, so only 2 of 3 tokens can be disabled here).
    // Re-test with parties: [] so all 3 tokens go through kind-groups.
    cleanup();
    render(
      <RedactionPreview
        raw={RAW}
        scrubbed={SCRUBBED}
        tokenMap={TOKEN_MAP}
        parties={[]}
        editableLabels={[]}
        onEditLabel={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /party/i }));
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

describe("RedactionPreview — editable labels (SP-1.9)", () => {
  const baseProps = {
    raw: "ACME Corp pays Beta LLC.",
    scrubbed: "\u27E6PROVIDER\u27E7 pays \u27E6CLIENT\u27E7.",
    tokenMap: new Map([
      ["\u27E6PROVIDER\u27E7", "ACME Corp"],
      ["\u27E6CLIENT\u27E7", "Beta LLC"],
    ]),
    parties: [
      { name: "ACME Corp", role_label: "Provider" },
      { name: "Beta LLC", role_label: "Client" },
    ],
    editableLabels: ["PROVIDER", "CLIENT"],
    onEditLabel: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  afterEach(cleanup);

  it("renders one editable input per party with live token preview", () => {
    render(<RedactionPreview {...baseProps} />);
    const inputs = screen.getAllByTestId("party-label-input");
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).value).toBe("PROVIDER");
    expect(screen.getByText(/⟦PROVIDER⟧/)).toBeTruthy();
    expect(screen.getByText(/⟦CLIENT⟧/)).toBeTruthy();
  });

  it("calls onEditLabel when the user types", () => {
    render(<RedactionPreview {...baseProps} />);
    const input = screen.getAllByTestId("party-label-input")[0];
    fireEvent.change(input, { target: { value: "Supplier" } });
    expect(baseProps.onEditLabel).toHaveBeenCalledWith(0, "Supplier");
  });

  it("disables Continue when any label is empty", () => {
    render(<RedactionPreview {...baseProps} editableLabels={["", "CLIENT"]} />);
    const confirm = screen.getByRole("button", { name: /Confirm/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Label required/i)).toBeTruthy();
  });

  it("shows collision hint when disambiguated (_2 suffix)", () => {
    render(
      <RedactionPreview
        {...baseProps}
        editableLabels={["PROVIDER", "PROVIDER_2"]}
      />,
    );
    expect(screen.getByText(/Distinguished from row above/i)).toBeTruthy();
  });

  it("does not show collision hint for labels ending in _1 (not a disambiguation suffix)", () => {
    render(
      <RedactionPreview
        {...baseProps}
        editableLabels={["PARTNER_1", "PARTNER_2"]}
      />,
    );
    // Only PARTNER_2 should trigger the hint, not PARTNER_1.
    const hints = screen.queryAllByText(/Distinguished from row above/i);
    expect(hints).toHaveLength(1);
  });
});
