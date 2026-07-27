import { describe, expect, it } from "vitest";
import { inspectAudio } from "../audio-quality";

describe("inspectAudio", () => {
  it("blocks clipped speech instead of producing an analysis-ready result", () => {
    const pcm = new Float32Array(48_000 * 8).fill(1);
    const quality = inspectAudio(pcm, 48_000);

    expect(quality.clippingRatio).toBe(1);
    expect(quality.issues).toContain("clipping이 큽니다.");
  });

  it("reports a too-short capture even when its level is usable", () => {
    const pcm = new Float32Array(48_000 * 4).fill(0.1);
    const quality = inspectAudio(pcm, 48_000);

    expect(quality.issues).toContain("유효 음성이 8초보다 짧습니다.");
  });

  it("accepts an 8-second capture despite floating-point duration precision", () => {
    const pcm = new Float32Array(44_100 * 8).fill(0.1);
    const quality = inspectAudio(pcm, 44_100);

    expect(quality.issues).not.toContain("유효 음성이 8초보다 짧습니다.");
  });

  it("uses 20ms frames at the browser sample rate when estimating noise", () => {
    const sampleRate = 48_000;
    const pcm = new Float32Array(sampleRate * 8).fill(0.1);
    for (let index = 0; index < pcm.length; index += sampleRate / 25) pcm.fill(0.001, index, index + sampleRate / 50);

    const quality = inspectAudio(pcm, sampleRate);

    expect(quality.estimatedSnrDb).toBeGreaterThan(20);
  });

  it("does not silently truncate an overlong local recording", () => {
    const quality = inspectAudio(new Float32Array(24_000 * 61).fill(0.1), 24_000);

    expect(quality.issues).toContain("60초를 초과한 파일은 구간을 선택한 뒤 다시 시도하세요.");
  });

  it("blocks a capture with dropped audio frames instead of trusting partial PCM", () => {
    const quality = inspectAudio(new Float32Array(24_000 * 8).fill(0.1), 24_000, true);

    expect(quality.droppedFrames).toBe(true);
    expect(quality.issues).toContain("녹음 중 오디오 프레임이 손실되었습니다.");
  });

  it("measures zero crossings from signal transitions rather than a hard-coded voice range", () => {
    const sampleRate = 24_000;
    const pcm = Float32Array.from({ length: sampleRate * 8 }, (_, index) =>
      Math.sin((2 * Math.PI * 220 * index) / sampleRate),
    );
    const quality = inspectAudio(pcm, sampleRate);

    expect(quality.zeroCrossingRateHz).toBeCloseTo(440, -1);
    expect(quality.pauseRatio).toBe(0);
  });
});
