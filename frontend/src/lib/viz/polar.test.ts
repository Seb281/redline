/**
 * Unit tests for polar geometry helpers.
 * All angle-based assertions use `toBeCloseTo` to tolerate floating-point
 * rounding from `Math.cos` / `Math.sin`.
 */

import { describe, it, expect } from "vitest";
import { polarToCartesian, describeArc, describeDonutSegment } from "./polar";

describe("polarToCartesian", () => {
  const cx = 40;
  const cy = 40;
  const r = 30;

  it("0 rad (3 o'clock) → rightmost point", () => {
    const { x, y } = polarToCartesian(cx, cy, r, 0);
    expect(x).toBeCloseTo(70, 5);
    expect(y).toBeCloseTo(40, 5);
  });

  it("π/2 rad (6 o'clock) → bottom point", () => {
    const { x, y } = polarToCartesian(cx, cy, r, Math.PI / 2);
    expect(x).toBeCloseTo(40, 5);
    expect(y).toBeCloseTo(70, 5);
  });

  it("π rad (9 o'clock) → leftmost point", () => {
    const { x, y } = polarToCartesian(cx, cy, r, Math.PI);
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(40, 5);
  });

  it("3π/2 rad (12 o'clock) → top point", () => {
    const { x, y } = polarToCartesian(cx, cy, r, (3 * Math.PI) / 2);
    expect(x).toBeCloseTo(40, 5);
    expect(y).toBeCloseTo(10, 5);
  });

  it("scales with r", () => {
    const { x } = polarToCartesian(0, 0, 10, 0);
    expect(x).toBeCloseTo(10, 5);
  });
});

describe("describeArc", () => {
  it("returns a string starting with M", () => {
    const d = describeArc(40, 40, 30, 0, Math.PI);
    expect(d).toMatch(/^M /);
  });

  it("contains an A command", () => {
    const d = describeArc(40, 40, 30, 0, Math.PI);
    expect(d).toMatch(/ A /);
  });

  it("sets large-arc-flag=1 for arc > π", () => {
    const d = describeArc(40, 40, 30, 0, Math.PI * 1.5);
    // large-arc-flag is 5th space-separated token after A
    expect(d).toMatch(/A 30 30 0 1 /);
  });

  it("sets large-arc-flag=0 for arc ≤ π", () => {
    const d = describeArc(40, 40, 30, 0, Math.PI * 0.5);
    expect(d).toMatch(/A 30 30 0 0 /);
  });
});

describe("describeDonutSegment", () => {
  it("returns a closed path (ends with Z)", () => {
    const d = describeDonutSegment(40, 40, 20, 30, 0, Math.PI);
    expect(d).toMatch(/Z$/);
  });

  it("contains two A commands (outer + inner arc)", () => {
    const d = describeDonutSegment(40, 40, 20, 30, 0, Math.PI);
    const aCount = (d.match(/ A /g) ?? []).length;
    expect(aCount).toBe(2);
  });

  it("full 360° sweep still produces a valid closed path", () => {
    const d = describeDonutSegment(40, 40, 20, 30, 0, 2 * Math.PI);
    expect(d).toMatch(/Z$/);
    // Must still contain M, A, L commands
    expect(d).toMatch(/M /);
    expect(d).toMatch(/ L /);
  });
});
