import { describe, expect, it } from "vitest";
import { createLocalAnalysis, scalarCsv } from "../results";

describe("local result export", () => {
  it("exports scalar values without raw audio and recommends a fix for clipping", () => {
    const result = createLocalAnalysis(
      { sampleRate: 48_000, durationSeconds: 20, effectiveVoiceSeconds: 16 },
      {
        durationSeconds: 20,
        rms: 0.1,
        peak: 1,
        clippingRatio: 0.02,
        dcOffset: 0,
        silenceRatio: 0.1,
        voicedRatio: 0.8,
        droppedFrames: false,
        issues: [],
      },
      { f0MedianHz: 220, frames: 10 },
      "0.1.0",
      "0.1.0",
    );
    const csv = scalarCsv(result);

    expect(result.recommendations[0]).toContain("입력 음량");
    expect(csv).toContain("f0MedianHz");
    expect(csv).not.toMatch(/pcm|waveform|audio/i);
  });

  it("ties a brightness goal to a measured low spectral centroid", () => {
    const result = createLocalAnalysis(
      { sampleRate: 24_000, durationSeconds: 20, effectiveVoiceSeconds: 16 },
      {
        durationSeconds: 20,
        rms: 0.1,
        peak: 0.2,
        clippingRatio: 0,
        dcOffset: 0,
        silenceRatio: 0.1,
        voicedRatio: 0.8,
        droppedFrames: false,
        issues: [],
      },
      { spectralCentroidHz: 1_000, frames: 10 },
      "0.1.0",
      "0.1.0",
      "brightness",
    );

    expect(result.recommendations).toContain(
      "음을 세게 밀기보다 입 앞쪽에서 울리는 느낌으로 명료한 모음을 유지해 보세요.",
    );
  });
});
