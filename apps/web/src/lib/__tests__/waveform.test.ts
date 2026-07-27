import { describe, expect, it } from "vitest";
import { peakEnvelope } from "../waveform";

describe("peakEnvelope", () => {
  it("keeps a short opposite-polarity transient visible instead of averaging it away", () => {
    const waveform = peakEnvelope(new Float32Array([0, 0.8, -0.8, 0, 0, 0]), 3);

    expect(waveform[0]).toBeCloseTo(0.8);
    expect(waveform[1]).toBeCloseTo(0.8);
    expect(waveform[2]).toBe(0);
  });
});
