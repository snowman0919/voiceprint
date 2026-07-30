import { describe, expect, it } from "vitest";
import { summarizeF0, summarizeFormants } from "../dsp";

describe("summarizeF0", () => {
  it("reports a one-octave contour as a 12-semitone range rather than a demographic category", () => {
    const summary = summarizeF0([100, 100, 100, 200, 200, 200]);

    expect(summary.f0SemitoneRange).toBeCloseTo(12, 5);
    expect(summary.f0Stability).toBeLessThan(100);
    expect(summary.f0ContourHz).toEqual([100, 100, 100, 200, 200, 200]);
  });
});

describe("summarizeFormants", () => {
  it("keeps ordered LPC observations and reports an explicit frame-success rate", () => {
    const summary = summarizeFormants(
      [
        [500, 1500, 2500],
        [520, 1520, 2520],
        [510, 1510, 2510],
      ],
      5,
    );
    expect(summary.f1MedianHz).toBe(510);
    expect(summary.f2MedianHz).toBe(1510);
    expect(summary.f3MedianHz).toBe(2510);
    expect(summary.formantSpacingHz).toBe(1000);
    expect(summary.estimatedVocalTractLengthCm).toBeCloseTo(17.5, 5);
    expect(summary.formantFrameSuccessRatio).toBeCloseTo(0.6, 5);
  });
});
