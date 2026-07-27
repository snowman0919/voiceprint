import { describe, expect, it } from "vitest";
import { decodeSharedResult, encodeSharedResult, type SharedResultV1 } from "../share";

const result: SharedResultV1 = {
  schemaVersion: 1,
  appVersion: "1.0.0",
  modelVersion: "pending",
  dspVersion: "0.1.0",
  summary: { impression: 58, brightness: 71, softness: 64, stability: 82 },
  acoustic: { f0Median: 220, f0P05: 180, f0P95: 260, voicedRatio: 0.8 },
  quality: { score: 90, clippingRatio: 0 },
};

describe("shared result codec", () => {
  it("round-trips only approved summary data, never raw audio", async () => {
    const withAudio = {
      ...result,
      pcm: "private-audio",
      embedding: [0.1, 0.2],
      f0ContourHz: [180, 220, 260],
      waveform: [0.1, 0.4],
      filename: "private-recording.wav",
    };
    const payload = await encodeSharedResult(withAudio);
    const decoded = await decodeSharedResult(payload);

    expect(decoded).toEqual(result);
    expect(JSON.stringify(decoded)).not.toMatch(/pcm|embedding|audio|contour|waveform|filename/i);
  });

  it("rejects a corrupted fragment rather than displaying invented results", async () => {
    await expect(decodeSharedResult("not-a-valid-deflate-payload")).rejects.toThrow("공유 링크를 읽을 수 없습니다.");
  });
});
