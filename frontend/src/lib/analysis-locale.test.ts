import { afterEach, describe, expect, it } from "vitest";
import { resolveAnalysisLocale } from "./analysis-locale";
import { routing } from "@/i18n/routing";

/**
 * Resolver contract (SP-7 Layer B'):
 *
 *   1. Invalid/missing locales coerce to `routing.defaultLocale` — the
 *      pipeline never 422s over a malformed `locale` field.
 *   2. `ANALYSIS_LOCALE_OVERRIDE` is respected only when its value is a
 *      routing locale; otherwise the env flag is treated as absent.
 *   3. `overridden` is `true` iff the override actually rewrote the
 *      request — used by the debug logger to flag ops-forced rewrites.
 */
describe("resolveAnalysisLocale", () => {
  const originalOverride = process.env.ANALYSIS_LOCALE_OVERRIDE;

  afterEach(() => {
    if (originalOverride === undefined) {
      delete process.env.ANALYSIS_LOCALE_OVERRIDE;
    } else {
      process.env.ANALYSIS_LOCALE_OVERRIDE = originalOverride;
    }
  });

  it("returns an EN resolution when override is unset and locale is EN", () => {
    delete process.env.ANALYSIS_LOCALE_OVERRIDE;
    expect(resolveAnalysisLocale("en")).toEqual({
      effective: "en",
      requested: "en",
      overridden: false,
    });
  });

  it("passes through every routing locale when override is unset", () => {
    delete process.env.ANALYSIS_LOCALE_OVERRIDE;
    for (const locale of routing.locales) {
      const r = resolveAnalysisLocale(locale);
      expect(r.effective).toBe(locale);
      expect(r.requested).toBe(locale);
      expect(r.overridden).toBe(false);
    }
  });

  it("coerces an unknown string locale to the routing defaultLocale", () => {
    delete process.env.ANALYSIS_LOCALE_OVERRIDE;
    const r = resolveAnalysisLocale("pt");
    expect(r.requested).toBe(routing.defaultLocale);
    expect(r.effective).toBe(routing.defaultLocale);
    expect(r.overridden).toBe(false);
  });

  it("coerces non-string bodyLocale to the routing defaultLocale", () => {
    delete process.env.ANALYSIS_LOCALE_OVERRIDE;
    for (const bad of [undefined, null, 123, {}, [], true]) {
      const r = resolveAnalysisLocale(bad);
      expect(r.requested).toBe(routing.defaultLocale);
      expect(r.effective).toBe(routing.defaultLocale);
      expect(r.overridden).toBe(false);
    }
  });

  it("rewrites to override and flags overridden=true when override differs from requested", () => {
    process.env.ANALYSIS_LOCALE_OVERRIDE = "en";
    const r = resolveAnalysisLocale("fr");
    expect(r.effective).toBe("en");
    expect(r.requested).toBe("fr");
    expect(r.overridden).toBe(true);
  });

  it("does not flag overridden=true when override matches the requested locale", () => {
    process.env.ANALYSIS_LOCALE_OVERRIDE = "de";
    const r = resolveAnalysisLocale("de");
    expect(r.effective).toBe("de");
    expect(r.requested).toBe("de");
    expect(r.overridden).toBe(false);
  });

  it("ignores an override that is not a routing locale", () => {
    process.env.ANALYSIS_LOCALE_OVERRIDE = "pt";
    const r = resolveAnalysisLocale("fr");
    expect(r.effective).toBe("fr");
    expect(r.requested).toBe("fr");
    expect(r.overridden).toBe(false);
  });

  it("ignores an empty-string / whitespace override", () => {
    process.env.ANALYSIS_LOCALE_OVERRIDE = "   ";
    const r = resolveAnalysisLocale("fr");
    expect(r.effective).toBe("fr");
    expect(r.overridden).toBe(false);
  });

  it("applies the override even when requested locale is invalid (invalid -> default -> overridden)", () => {
    // Invalid requested locale is first coerced to defaultLocale (EN);
    // if the override is a non-EN routing locale, the effective locale
    // is the override. `overridden` is true because the final effective
    // differs from the post-validation requested.
    process.env.ANALYSIS_LOCALE_OVERRIDE = "fr";
    const r = resolveAnalysisLocale("pt");
    expect(r.requested).toBe(routing.defaultLocale);
    expect(r.effective).toBe("fr");
    expect(r.overridden).toBe(true);
  });
});
