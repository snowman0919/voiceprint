import { describe, expect, it } from "vitest";
import { hangulCoverage, minimumRecordingSeconds, readingScripts } from "../reading-scripts";

describe("measurement reading scripts", () => {
  it("keeps each standardized script long enough for the minimum recording", () => {
    expect(minimumRecordingSeconds).toBe(30);
    expect(
      readingScripts.every((script) => script.targetSeconds >= minimumRecordingSeconds && script.text.length >= 180),
    ).toBe(true);
  });

  it("keeps varied Korean consonant, vowel, and final-consonant coverage", () => {
    const coverage = hangulCoverage(readingScripts.map((script) => script.text).join(""));
    expect(coverage.initials).toBeGreaterThanOrEqual(17);
    expect(coverage.vowels).toBeGreaterThanOrEqual(15);
    expect(coverage.finals).toBeGreaterThanOrEqual(15);
  });
});
