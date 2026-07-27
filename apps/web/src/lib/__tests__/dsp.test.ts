import { describe, expect, it } from "vitest";
import { summarizeF0 } from "../dsp";

describe("summarizeF0", () => {
  it("reports a one-octave contour as a 12-semitone range rather than a demographic category", () => {
    const summary = summarizeF0([100, 100, 100, 200, 200, 200]);

    expect(summary.f0SemitoneRange).toBeCloseTo(12, 5);
    expect(summary.f0Stability).toBeLessThan(100);
    expect(summary.f0ContourHz).toEqual([100, 100, 100, 200, 200, 200]);
  });
});
