export const analysisConfig = {
  version: "0.1.0",
  sampleRate: 24_000,
  f0FrameSeconds: 0.08,
  maxSummaryFrames: 20,
  spectralFftSize: 1_024,
  maximumInputSeconds: 60,
} as const;
