/**
 * Unit tests for the retention pill copy helper.
 *
 * Keeping these close to the helper (not the page) so the copy rules
 * can be asserted without mounting React. The page just renders the
 * `label` string verbatim.
 */

import { describe, it, expect } from "vitest";
import { getRetentionStatus } from "./retention";

const NOW = new Date("2026-04-19T12:00:00Z");

describe("getRetentionStatus", () => {
  it("marks pinned rows as never expiring", () => {
    const s = getRetentionStatus("2026-04-10T00:00:00Z", true, NOW);
    expect(s.pinned).toBe(true);
    expect(s.expired).toBe(false);
    expect(s.label).toBe("Pinned");
  });

  it("reports 'Expired' once expires_at is in the past", () => {
    const s = getRetentionStatus("2026-04-10T00:00:00Z", false, NOW);
    expect(s.expired).toBe(true);
    expect(s.label).toBe("Expired");
  });

  it("reports 'Expires today' when less than a day remains", () => {
    const s = getRetentionStatus("2026-04-19T23:30:00Z", false, NOW);
    expect(s.expired).toBe(false);
    expect(s.label).toBe("Expires today");
  });

  it("rounds up to whole days for the countdown", () => {
    // ~7.5 days ahead — should display as 8 days.
    const s = getRetentionStatus("2026-04-27T00:00:00Z", false, NOW);
    expect(s.daysRemaining).toBe(8);
    expect(s.label).toBe("Expires in 8 days");
  });

  it("gracefully handles a missing expires_at (pre-migration row)", () => {
    const s = getRetentionStatus(null, false, NOW);
    expect(s.expired).toBe(false);
    expect(s.label).toBe("No expiry");
  });
});
