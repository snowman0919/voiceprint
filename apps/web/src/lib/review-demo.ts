import type { SharedResultV1 } from "@/lib/share";

/**
 * A deliberately synthetic result for reviewing the result screen.
 * It contains neither a recording nor labels from a training corpus.
 */
export const reviewDemoResult: SharedResultV1 = {
  schemaVersion: 1,
  appVersion: "review-fixture",
  modelVersion: "not-deployed",
  dspVersion: "synthetic",
  createdAt: "2026-07-30T00:00:00.000Z",
  summary: { masculinity: 51, femininity: 49, brightness: 62, stability: 76 },
  acoustic: { f0Median: 184, f0P05: 163, f0P95: 211, hnr: 16.2, voicedRatio: 0.74 },
  quality: { score: 86, snr: 24.8, clippingRatio: 0.001 },
  provenance: {
    summary: "deterministic_derived_metric",
    acoustic: "direct_acoustic_measurement",
    quality: "deterministic_derived_metric",
    details: "direct_acoustic_measurement",
  },
};
