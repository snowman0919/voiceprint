import { inspectAudio } from "@/lib/audio-quality";
import { analysisConfig } from "@/lib/analysis-config";
import { summarizeF0, type DspSummary } from "@/lib/dsp";
import { peakEnvelope } from "@/lib/waveform";

type Request = { pcm: ArrayBuffer; sampleRate: number; droppedFrames?: boolean };
type Stage = "input" | "pitch" | "timbre" | "finalizing";

function stage(value: Stage) {
  self.postMessage({ type: "stage", value });
}

async function analyzeDsp(pcm: Float32Array, sampleRate: number): Promise<DspSummary> {
  const wasm = await import("@/generated/voice_dsp.js");
  await wasm.default(new URL("/wasm/voice_dsp_bg.wasm", self.location.origin));
  const analysisPcm = sampleRate === analysisConfig.sampleRate ? pcm : wasm.resample_to_24khz(pcm, sampleRate);
  const analysisSampleRate = analysisConfig.sampleRate;
  const frameSize = Math.round(analysisSampleRate * analysisConfig.f0FrameSeconds);
  const frameCount = Math.min(analysisConfig.maxSummaryFrames, Math.floor(analysisPcm.length / frameSize));
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
  stage("timbre");
  const centroidFrame = analysisPcm.subarray(0, Math.min(analysisConfig.spectralFftSize, analysisPcm.length));
  const centroid =
    centroidFrame.length === analysisConfig.spectralFftSize
      ? wasm.spectral_centroid_hz(centroidFrame, analysisSampleRate)
      : Number.NaN;
  const bandwidth =
    centroidFrame.length === analysisConfig.spectralFftSize
      ? wasm.spectral_bandwidth_hz(centroidFrame, analysisSampleRate)
      : Number.NaN;
  const rolloff85 =
    centroidFrame.length === analysisConfig.spectralFftSize
      ? wasm.spectral_rolloff_85_hz(centroidFrame, analysisSampleRate)
      : Number.NaN;
  const rolloff95 =
    centroidFrame.length === analysisConfig.spectralFftSize
      ? wasm.spectral_rolloff_95_hz(centroidFrame, analysisSampleRate)
      : Number.NaN;
  const flatness =
    centroidFrame.length === analysisConfig.spectralFftSize
      ? wasm.spectral_flatness(centroidFrame, analysisSampleRate)
      : Number.NaN;
  return {
    ...summarizeF0(f0),
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
  const quality = inspectAudio(pcm, data.sampleRate, data.droppedFrames);
  try {
    const dsp = await analyzeDsp(pcm, data.sampleRate);
    stage("finalizing");
    self.postMessage({ type: "result", quality, dsp, waveform: peakEnvelope(pcm) });
  } catch {
    stage("finalizing");
    self.postMessage({ type: "result", quality, dsp: undefined, waveform: peakEnvelope(pcm) });
  }
};
