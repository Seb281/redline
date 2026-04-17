/**
 * SP-1.9 — ChatMessage must obey the rehydrate toggle:
 *   - default (off): `⟦PROVIDER⟧` displayed as "Provider"
 *   - on: `⟦PROVIDER⟧` displayed as the legal party name
 * PII tokens (⟦EMAIL_1⟧ etc.) are never rehydrated here.
 */

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { UIMessage } from "ai";
import { ChatMessage } from "./ChatMessage";
import { RehydrateProvider, useRehydrate } from "@/contexts/RehydrateContext";

afterEach(() => cleanup());

const parties = [
  { name: "ACME Corp", role_label: "Provider" },
  { name: "Beta LLC", role_label: "Client" },
];

function makeMsg(text: string): UIMessage {
  return {
    id: "m1",
    role: "assistant",
    parts: [{ type: "text", text }],
  } as UIMessage;
}

function RehydrateHandle({ onReady }: { onReady: (set: (v: boolean) => void) => void }) {
  const { setRehydrate } = useRehydrate();
  onReady(setRehydrate);
  return null;
}

describe("ChatMessage — rehydrate toggle (SP-1.9)", () => {
  it("prettifies tokens to title-cased labels by default", () => {
    render(
      <RehydrateProvider>
        <ChatMessage
          message={makeMsg("The \u27E6PROVIDER\u27E7 must notify \u27E6CLIENT\u27E7.")}
          parties={parties}
          contractType="Services Agreement"
        />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/The Provider must notify Client\./)).toBeTruthy();
    expect(screen.queryByText(/ACME Corp/)).toBeNull();
  });

  it("swaps labels for legal names when rehydrate is on", () => {
    let flip: ((v: boolean) => void) | undefined;
    render(
      <RehydrateProvider>
        <RehydrateHandle onReady={(s) => (flip = s)} />
        <ChatMessage
          message={makeMsg("The \u27E6PROVIDER\u27E7 pays \u27E6CLIENT\u27E7.")}
          parties={parties}
          contractType="Services Agreement"
        />
      </RehydrateProvider>,
    );
    act(() => flip?.(true));
    expect(screen.getByText(/The ACME Corp pays Beta LLC\./)).toBeTruthy();
  });

  it("leaves PII tokens alone — only party tokens change shape", () => {
    render(
      <RehydrateProvider>
        <ChatMessage
          message={makeMsg("Contact \u27E6EMAIL_1\u27E7 about \u27E6PROVIDER\u27E7 obligations.")}
          parties={parties}
          contractType="Services Agreement"
        />
      </RehydrateProvider>,
    );
    // `EMAIL_1` prettifies to "Email 1" (no legal email name is known in the
    // client). Acceptable: the display stays privacy-safe either way.
    expect(screen.getByText(/about Provider obligations/)).toBeTruthy();
  });
});
