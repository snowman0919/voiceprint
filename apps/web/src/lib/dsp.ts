export type DspSummary = {
  f0MedianHz?: number;
  f0P05Hz?: number;
  f0P95Hz?: number;
  spectralCentroidHz?: number;
  spectralBandwidthHz?: number;
  spectralRolloff85Hz?: number;
  spectralRolloff95Hz?: number;
  spectralFlatness?: number;
  hnrDb?: number;
  frames: number;
};
