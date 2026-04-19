/**
 * Unit tests for the `mergeMessages` deep-merge helper that makes
 * partial locale catalogs safe — any key missing from a locale falls
 * through to the English source rather than crashing with
 * `MISSING_MESSAGE`.
 */

import { describe, it, expect } from "vitest";
import { mergeMessages } from "./request";

describe("mergeMessages", () => {
  it("overwrites primitive values when the overlay provides one", () => {
    const base = { Header: { logOut: "Log out" } };
    const overlay = { Header: { logOut: "Déconnexion" } };
    expect(mergeMessages(base, overlay)).toEqual({
      Header: { logOut: "Déconnexion" },
    });
  });

  it("falls back to the base value when the overlay omits the key", () => {
    const base = { Header: { logOut: "Log out", login: "Log in" } };
    const overlay = { Header: { logOut: "Déconnexion" } };
    expect(mergeMessages(base, overlay)).toEqual({
      Header: { logOut: "Déconnexion", login: "Log in" },
    });
  });

  it("recurses into nested namespaces", () => {
    const base = {
      RedactionPreview: { kinds: { EMAIL: "Emails", PHONE: "Phones" } },
    };
    const overlay = {
      RedactionPreview: { kinds: { EMAIL: "E-mails" } },
    };
    expect(mergeMessages(base, overlay)).toEqual({
      RedactionPreview: { kinds: { EMAIL: "E-mails", PHONE: "Phones" } },
    });
  });

  it("treats empty / whitespace overrides as missing (keeps base)", () => {
    const base = { Header: { logOut: "Log out" } };
    const overlay = { Header: { logOut: "   " } };
    expect(mergeMessages(base, overlay)).toEqual({
      Header: { logOut: "Log out" },
    });
  });

  it("replaces arrays wholesale — does not merge element-wise", () => {
    const base = { X: { list: ["a", "b", "c"] } };
    const overlay = { X: { list: ["z"] } };
    expect(mergeMessages(base, overlay)).toEqual({ X: { list: ["z"] } });
  });

  it("adds new keys the base did not have", () => {
    const base = { Header: { logOut: "Log out" } };
    const overlay = { Header: { login: "Se connecter" } };
    expect(mergeMessages(base, overlay)).toEqual({
      Header: { logOut: "Log out", login: "Se connecter" },
    });
  });

  it("handles an empty overlay (pure passthrough of base)", () => {
    const base = { Header: { logOut: "Log out" } };
    expect(mergeMessages(base, {})).toEqual(base);
  });
});
