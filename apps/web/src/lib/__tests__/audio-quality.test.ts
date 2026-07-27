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
});
