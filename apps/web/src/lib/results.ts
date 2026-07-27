import type { AudioQuality } from "./audio-quality";
import type { DspSummary } from "./dsp";

export type LocalAnalysis = {
  schemaVersion: 1;
  createdAt: string;
  appVersion: string;
  modelVersion: "not-deployed";
  dspVersion: string;
  input: { sampleRate: number; durationSeconds: number; effectiveVoiceSeconds: number };
  quality: AudioQuality & { score: number };
  acousticFeatures: DspSummary;
  modelOutputs: null;
  recommendations: string[];
};

export function recommendations(quality: AudioQuality, dsp: DspSummary) {
  const result: string[] = [];
  if (quality.clippingRatio > 0.01) result.push("마이크에서 조금 멀어지거나 입력 음량을 낮춘 뒤 다시 측정하세요.");
  if (quality.rms < 0.01) result.push("마이크와 15~25cm 거리를 유지하고 일정한 호흡으로 말해 보세요.");
  if (dsp.f0P05Hz && dsp.f0P95Hz && dsp.f0P95Hz - dsp.f0P05Hz < 20) result.push("핵심 단어에서만 높이를 조금 올려 억양 변화를 연습해 보세요.");
  return result.length ? result : ["현재 입력 품질은 측정 가능한 범위입니다. 무리한 발성 대신 편안한 음역을 유지하세요."];
}

export function createLocalAnalysis(input: LocalAnalysis["input"], quality: AudioQuality, dsp: DspSummary, appVersion: string, dspVersion: string): LocalAnalysis {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    appVersion,
    modelVersion: "not-deployed",
    dspVersion,
    input,
    quality: { ...quality, score: Math.max(0, Math.round(100 - quality.clippingRatio * 1_000 - quality.silenceRatio * 25)) },
    acousticFeatures: dsp,
    modelOutputs: null,
    recommendations: recommendations(quality, dsp),
  };
}

export function scalarCsv(result: LocalAnalysis) {
  const values = {
    sampleRate: result.input.sampleRate,
    durationSeconds: result.input.durationSeconds,
    effectiveVoiceSeconds: result.input.effectiveVoiceSeconds,
    qualityScore: result.quality.score,
    clippingRatio: result.quality.clippingRatio,
    voicedRatio: result.quality.voicedRatio,
    f0MedianHz: result.acousticFeatures.f0MedianHz ?? "",
    f0P05Hz: result.acousticFeatures.f0P05Hz ?? "",
    f0P95Hz: result.acousticFeatures.f0P95Hz ?? "",
    spectralCentroidHz: result.acousticFeatures.spectralCentroidHz ?? "",
  };
  return `${Object.keys(values).join(",")}\n${Object.values(values).join(",")}\n`;
}
