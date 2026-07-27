import { inspectAudio } from "@/lib/audio-quality";
import type { DspSummary } from "@/lib/dsp";
import { peakEnvelope } from "@/lib/waveform";

type Request = { pcm: ArrayBuffer; sampleRate: number };
type Stage = "input" | "pitch" | "timbre" | "finalizing";

function stage(value: Stage) { self.postMessage({ type: "stage", value }); }

function percentile(values: number[], fraction: number) {
  const index = Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * fraction)));
  return values[index];
}

async function analyzeDsp(pcm: Float32Array, sampleRate: number): Promise<DspSummary> {
  const wasm = await import("@/generated/voice_dsp.js");
  await wasm.default(new URL("/wasm/voice_dsp_bg.wasm", self.location.origin));
  const analysisPcm = sampleRate === 24_000 ? pcm : wasm.resample_to_24khz(pcm, sampleRate);
  const analysisSampleRate = 24_000;
  const frameSize = Math.round(analysisSampleRate * 0.08);
  const frameCount = Math.min(20, Math.floor(analysisPcm.length / frameSize));
  const f0: number[] = [];
  const hnr: number[] = [];
  stage("pitch");
  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = Math.floor((analysisPcm.length - frameSize) * (frameCount === 1 ? 0 : frame / (frameCount - 1)));
    const value = wasm.estimate_f0_hz(analysisPcm.subarray(offset, offset + frameSize), analysisSampleRate);
    if (Number.isFinite(value)) f0.push(value);
    const hnrValue = wasm.hnr_db(analysisPcm.subarray(offset, offset + frameSize), analysisSampleRate);
    if (Number.isFinite(hnrValue)) hnr.push(hnrValue);
  }
  f0.sort((left, right) => left - right);
  stage("timbre");
  const centroidFrame = analysisPcm.subarray(0, Math.min(1024, analysisPcm.length));
  const centroid = centroidFrame.length === 1024 ? wasm.spectral_centroid_hz(centroidFrame, analysisSampleRate) : Number.NaN;
  const bandwidth = centroidFrame.length === 1024 ? wasm.spectral_bandwidth_hz(centroidFrame, analysisSampleRate) : Number.NaN;
  const rolloff85 = centroidFrame.length === 1024 ? wasm.spectral_rolloff_85_hz(centroidFrame, analysisSampleRate) : Number.NaN;
  const rolloff95 = centroidFrame.length === 1024 ? wasm.spectral_rolloff_95_hz(centroidFrame, analysisSampleRate) : Number.NaN;
  const flatness = centroidFrame.length === 1024 ? wasm.spectral_flatness(centroidFrame, analysisSampleRate) : Number.NaN;
  return {
    f0MedianHz: f0.length ? percentile(f0, 0.5) : undefined,
    f0P05Hz: f0.length ? percentile(f0, 0.05) : undefined,
    f0P95Hz: f0.length ? percentile(f0, 0.95) : undefined,
    spectralCentroidHz: Number.isFinite(centroid) ? centroid : undefined,
    spectralBandwidthHz: Number.isFinite(bandwidth) ? bandwidth : undefined,
    spectralRolloff85Hz: Number.isFinite(rolloff85) ? rolloff85 : undefined,
    spectralRolloff95Hz: Number.isFinite(rolloff95) ? rolloff95 : undefined,
    spectralFlatness: Number.isFinite(flatness) ? flatness : undefined,
    hnrDb: hnr.length ? hnr.reduce((total, value) => total + value, 0) / hnr.length : undefined,
    frames: f0.length,
  };
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  const pcm = new Float32Array(data.pcm);
  stage("input");
  const quality = inspectAudio(pcm, data.sampleRate);
  try {
    const dsp = await analyzeDsp(pcm, data.sampleRate);
    stage("finalizing");
    self.postMessage({ type: "result", quality, dsp, waveform: peakEnvelope(pcm) });
  } catch {
    stage("finalizing");
    self.postMessage({ type: "result", quality, dsp: undefined, waveform: peakEnvelope(pcm) });
  }
};
