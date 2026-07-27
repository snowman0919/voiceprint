import { inspectAudio } from "@/lib/audio-quality";
import type { DspSummary } from "@/lib/dsp";
import { peakEnvelope } from "@/lib/waveform";

type Request = { pcm: ArrayBuffer; sampleRate: number };

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
  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = Math.floor((analysisPcm.length - frameSize) * (frameCount === 1 ? 0 : frame / (frameCount - 1)));
    const value = wasm.estimate_f0_hz(analysisPcm.subarray(offset, offset + frameSize), analysisSampleRate);
    if (Number.isFinite(value)) f0.push(value);
    const hnrValue = wasm.hnr_db(analysisPcm.subarray(offset, offset + frameSize), analysisSampleRate);
    if (Number.isFinite(hnrValue)) hnr.push(hnrValue);
  }
  f0.sort((left, right) => left - right);
  const centroidFrame = analysisPcm.subarray(0, Math.min(1024, analysisPcm.length));
  const centroid = centroidFrame.length === 1024 ? wasm.spectral_centroid_hz(centroidFrame, analysisSampleRate) : Number.NaN;
  return {
    f0MedianHz: f0.length ? percentile(f0, 0.5) : undefined,
    f0P05Hz: f0.length ? percentile(f0, 0.05) : undefined,
    f0P95Hz: f0.length ? percentile(f0, 0.95) : undefined,
    spectralCentroidHz: Number.isFinite(centroid) ? centroid : undefined,
    hnrDb: hnr.length ? hnr.reduce((total, value) => total + value, 0) / hnr.length : undefined,
    frames: f0.length,
  };
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  const pcm = new Float32Array(data.pcm);
  const quality = inspectAudio(pcm, data.sampleRate);
  try {
    self.postMessage({ quality, dsp: await analyzeDsp(pcm, data.sampleRate), waveform: peakEnvelope(pcm) });
  } catch {
    self.postMessage({ quality, dsp: undefined, waveform: peakEnvelope(pcm) });
  }
};
