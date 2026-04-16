/**
 * Unit tests for the dev-only pipeline debug logger.
 *
 * Guards: double env gate, format stability, string-length clamp
 * (privacy defense-in-depth — free-form values can never exceed 40
 * characters in output).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logPass } from "./debug-log";

describe("logPass", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  const originalFlag = process.env.REDLINE_DEBUG_PIPELINE;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    spy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
    process.env.REDLINE_DEBUG_PIPELINE = originalFlag;
    process.env.NODE_ENV = originalEnv;
  });

  it("is a no-op when REDLINE_DEBUG_PIPELINE is unset", () => {
    delete process.env.REDLINE_DEBUG_PIPELINE;
    process.env.NODE_ENV = "development";
    logPass("overview", { inventoryCount: 12 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("is a no-op when NODE_ENV is production, even with the flag on", () => {
    process.env.REDLINE_DEBUG_PIPELINE = "1";
    process.env.NODE_ENV = "production";
    logPass("overview", { inventoryCount: 12 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("emits a single line with pass name and key=value pairs when enabled", () => {
    process.env.REDLINE_DEBUG_PIPELINE = "1";
    process.env.NODE_ENV = "development";
    logPass("overview", { inventoryCount: 12, partyCount: 2, ms: 340 });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    expect(line.startsWith("[redline-debug] pass=overview ")).toBe(true);
    expect(line).toContain("inventoryCount=12");
    expect(line).toContain("partyCount=2");
    expect(line).toContain("ms=340");
  });

  it("clamps free-form string values to 40 characters with an ellipsis", () => {
    process.env.REDLINE_DEBUG_PIPELINE = "1";
    process.env.NODE_ENV = "development";
    const canary =
      "CANARY_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_THIS_MUST_NOT_LEAK";
    logPass("overview", { jurisdiction: canary });
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toContain(canary);
    expect(line).toMatch(
      /jurisdiction=CANARY_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456…/,
    );
  });

  it("serialises booleans and numbers verbatim", () => {
    process.env.REDLINE_DEBUG_PIPELINE = "1";
    process.env.NODE_ENV = "development";
    logPass("pass2", { streamed: 0, collapsed: true });
    const line = spy.mock.calls[0][0] as string;
    expect(line).toContain("streamed=0");
    expect(line).toContain("collapsed=true");
  });
});
