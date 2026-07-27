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
  const frameSize = Math.round(sampleRate * 0.08);
  const frameCount = Math.min(20, Math.floor(pcm.length / frameSize));
  const f0: number[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = Math.floor((pcm.length - frameSize) * (frameCount === 1 ? 0 : frame / (frameCount - 1)));
    const value = wasm.estimate_f0_hz(pcm.subarray(offset, offset + frameSize), sampleRate);
    if (Number.isFinite(value)) f0.push(value);
  }
  f0.sort((left, right) => left - right);
  const centroidFrame = pcm.subarray(0, Math.min(1024, pcm.length));
  const centroid = centroidFrame.length === 1024 ? wasm.spectral_centroid_hz(centroidFrame, sampleRate) : Number.NaN;
  return {
    f0MedianHz: f0.length ? percentile(f0, 0.5) : undefined,
    f0P05Hz: f0.length ? percentile(f0, 0.05) : undefined,
    f0P95Hz: f0.length ? percentile(f0, 0.95) : undefined,
    spectralCentroidHz: Number.isFinite(centroid) ? centroid : undefined,
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
