import { describe, expect, it } from "vitest";
import { createLocalAnalysis, scalarCsv } from "../results";

describe("local result export", () => {
  it("exports scalar values without raw audio and recommends a fix for clipping", () => {
    const result = createLocalAnalysis({ sampleRate: 48_000, durationSeconds: 20, effectiveVoiceSeconds: 16 }, { durationSeconds: 20, rms: 0.1, peak: 1, clippingRatio: 0.02, dcOffset: 0, silenceRatio: 0.1, voicedRatio: 0.8, issues: [] }, { f0MedianHz: 220, frames: 10 }, "0.1.0", "0.1.0");
    const csv = scalarCsv(result);

    expect(result.recommendations[0]).toContain("입력 음량");
    expect(csv).toContain("f0MedianHz");
    expect(csv).not.toMatch(/pcm|waveform|audio/i);
  });
});
