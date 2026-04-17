/**
 * Pass 0 parity check for SP-1.6.
 *
 * SP-1.6 moved pattern masking (emails, phones, IBANs, VAT, national
 * IDs) to BEFORE Pass 0 runs. This test asserts that masking doesn't
 * degrade Pass 0's structural output on the three EU sample contracts:
 * same party-count floor, same jurisdiction detection, and clause
 * inventory within ±30% of the raw baseline.
 *
 * Gated by MISTRAL_API_KEY to match the SP-1 snapshot harness pattern
 * (CI without secrets + local devs without a key still pass).
 */

import { describe, it, expect } from "vitest";
import { generateOverview } from "../streaming-analyzer";
import { getProvider } from "../llm/provider";
import { redactPatterns } from "./index";
import { SAMPLE_CONTRACT_TEXT as NL_TEXT } from "@/data/sample-contracts/nl-freelance";
import { FR_EMPLOYMENT_TEXT } from "@/data/sample-contracts/fr-employment";
import { DE_SAAS_DPA_TEXT } from "@/data/sample-contracts/de-saas-dpa";

const HAS_KEY = Boolean(process.env.MISTRAL_API_KEY);
const describeIfKey = HAS_KEY ? describe : describe.skip;
const TIMEOUT_MS = 180_000;

describeIfKey("SP-1.6 Pass 0 parity — raw vs patterns-masked", () => {
  const provider = getProvider("mistral");

  const cases = [
    { name: "NL freelance", text: NL_TEXT, juris: /netherlands|dutch|nl/ },
    {
      name: "FR employment",
      text: FR_EMPLOYMENT_TEXT,
      juris: /france|french|fr/,
    },
    {
      name: "DE SaaS+DPA",
      text: DE_SAAS_DPA_TEXT,
      juris: /germany|german|de|deutschland/,
    },
  ];

  for (const c of cases) {
    it(
      `${c.name}: patterns-masked Pass 0 matches raw on structure`,
      async () => {
        const { scrubbed } = redactPatterns(c.text);
        const [raw, masked] = await Promise.all([
          generateOverview(c.text, provider),
          generateOverview(scrubbed, provider),
        ]);

        // Party count floor — masking must not lose a party. Allow ±1
        // wobble because Mistral's party extraction is slightly
        // stochastic even with temperature=0.
        expect(masked.parties.length).toBeGreaterThanOrEqual(
          Math.max(1, raw.parties.length - 1),
        );

        // Jurisdiction — must still be detected on masked input.
        expect(masked.governing_jurisdiction?.toLowerCase()).toMatch(c.juris);

        // SP-1.7 — evidence block must travel with the detected jurisdiction.
        // Masking shouldn't downgrade a stated jurisdiction to unknown.
        expect(masked.jurisdiction_evidence?.source_type).toMatch(
          /stated|inferred/,
        );

        // Inventory band — within ±30% of raw count.
        const lo = Math.floor(raw.clause_inventory.length * 0.7);
        const hi = Math.ceil(raw.clause_inventory.length * 1.3);
        expect(masked.clause_inventory.length).toBeGreaterThanOrEqual(lo);
        expect(masked.clause_inventory.length).toBeLessThanOrEqual(hi);
      },
      TIMEOUT_MS,
    );
  }
});
