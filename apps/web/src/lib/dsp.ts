export type Spectrogram = {
  frames: number;
  bins: number;
  levels: Uint8Array;
};

export type DspSummary = {
  f0MedianHz?: number;
  f0MeanHz?: number;
  f0StdDevHz?: number;
  f0P05Hz?: number;
  f0P95Hz?: number;
  f0SemitoneRange?: number;
  f0Stability?: number;
  f0ContourHz?: number[];
  f1MedianHz?: number;
  f2MedianHz?: number;
  f3MedianHz?: number;
  formantSpacingHz?: number;
  estimatedVocalTractLengthCm?: number;
  formantFrameSuccessRatio?: number;
  spectralCentroidHz?: number;
  spectralBandwidthHz?: number;
  spectralRolloff85Hz?: number;
  spectralRolloff95Hz?: number;
  spectralFlatness?: number;
  spectralSlopeDbPerKhz?: number;
  spectralFlux?: number;
  lowBandEnergyRatio?: number;
  midBandEnergyRatio?: number;
  highBandEnergyRatio?: number;
  hnrDb?: number;
  frames: number;
  spectrogram?: Spectrogram;
};

export type FormantTriplet = readonly [number, number, number];

function percentile(values: number[], fraction: number) {
  const index = Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * fraction)));
  return values[index];
}

export function summarizeF0(
  values: number[],
): Pick<
  DspSummary,
  | "f0MedianHz"
  | "f0MeanHz"
  | "f0StdDevHz"
  | "f0P05Hz"
  | "f0P95Hz"
  | "f0SemitoneRange"
  | "f0Stability"
  | "f0ContourHz"
  | "frames"
> {
  if (!values.length) return { frames: 0 };
  const sorted = [...values].sort((left, right) => left - right);
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length);
  const p05 = percentile(sorted, 0.05);
  const p95 = percentile(sorted, 0.95);
  const semitoneRange = 12 * Math.log2(p95 / p05);
  return {
    f0MedianHz: percentile(sorted, 0.5),
    f0MeanHz: mean,
    f0StdDevHz: stdDev,
    f0P05Hz: p05,
    f0P95Hz: p95,
    f0SemitoneRange: semitoneRange,
    f0Stability: Math.max(0, Math.min(100, 100 - (stdDev / mean) * 500)),
    f0ContourHz: values,
    frames: values.length,
  };
}

/** Conservative LPC formant aggregate; unavailable frames never become invented values. */
export function summarizeFormants(values: FormantTriplet[], attemptedFrames: number): Pick<
  DspSummary,
  | "f1MedianHz"
  | "f2MedianHz"
  | "f3MedianHz"
  | "formantSpacingHz"
  | "estimatedVocalTractLengthCm"
  | "formantFrameSuccessRatio"
> {
  const success = attemptedFrames > 0 ? values.length / attemptedFrames : 0;
  if (!values.length) return { formantFrameSuccessRatio: success };
  const median = (index: number) => percentile(values.map((value) => value[index]).sort((left, right) => left - right), 0.5);
  const f1 = median(0);
  const f2 = median(1);
  const f3 = median(2);
  const spacing = (f3 - f1) / 2;
  return {
    f1MedianHz: f1,
    f2MedianHz: f2,
    f3MedianHz: f3,
    formantSpacingHz: spacing,
    estimatedVocalTractLengthCm: spacing > 0 ? 17_500 / spacing : undefined,
    formantFrameSuccessRatio: success,
  };
}
