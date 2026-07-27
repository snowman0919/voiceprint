import type { AudioQuality } from "./audio-quality";
import type { DspSummary } from "./dsp";

export const practiceGoals = [
  "clarity",
  "stability",
  "brightness",
  "softness",
  "calm",
  "lightness",
  "intonation",
  "relaxation",
] as const;
export type PracticeGoal = (typeof practiceGoals)[number];

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
  practiceGoal: PracticeGoal;
  recommendations: string[];
};

export function recommendations(quality: AudioQuality, dsp: DspSummary, goal: PracticeGoal) {
  const result: string[] = [];
  if (quality.clippingRatio > 0.01) result.push("마이크에서 조금 멀어지거나 입력 음량을 낮춘 뒤 다시 측정하세요.");
  if (quality.rms < 0.01) result.push("마이크와 15~25cm 거리를 유지하고 일정한 호흡으로 말해 보세요.");
  if (dsp.f0P05Hz && dsp.f0P95Hz && dsp.f0P95Hz - dsp.f0P05Hz < 20)
    result.push("핵심 단어에서만 높이를 조금 올려 억양 변화를 연습해 보세요.");
  if (goal === "clarity") result.push("자음을 세게 밀기보다 모음 길이를 일정하게 유지하며 또렷하게 말해 보세요.");
  if (goal === "stability" && (dsp.f0Stability ?? 100) < 75)
    result.push("목에 힘을 주어 높이를 고정하지 말고, 편안한 음역에서 일정한 호흡으로 문장을 반복하세요.");
  if (goal === "brightness" && (dsp.spectralCentroidHz ?? 0) < 1_500)
    result.push("음을 세게 밀기보다 입 앞쪽에서 울리는 느낌으로 명료한 모음을 유지해 보세요.");
  if (goal === "softness") result.push("문장 시작을 강하게 치지 말고, 낮은 음량에서 모음으로 부드럽게 연결해 보세요.");
  if (goal === "calm") result.push("낮추려고 힘주지 말고, 편안한 음역 안에서 문장 끝을 부드럽게 정리해 보세요.");
  if (goal === "lightness") result.push("무리하게 높이지 말고, 짧은 모음을 편안한 크기로 이어 보세요.");
  if (goal === "intonation" && (dsp.f0SemitoneRange ?? 0) < 2)
    result.push("핵심 단어에서만 높이를 조금 올리고, 문장 끝의 높이를 의도적으로 정리해 보세요.");
  if (goal === "relaxation") result.push("숨을 밀어내기보다 일정한 호흡으로 짧은 문장을 쉬어가며 반복해 보세요.");
  return result.length
    ? result
    : ["현재 입력 품질은 측정 가능한 범위입니다. 무리한 발성 대신 편안한 음역을 유지하세요."];
}

export function createLocalAnalysis(
  input: LocalAnalysis["input"],
  quality: AudioQuality,
  dsp: DspSummary,
  appVersion: string,
  dspVersion: string,
  practiceGoal: PracticeGoal = "clarity",
): LocalAnalysis {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    appVersion,
    modelVersion: "not-deployed",
    dspVersion,
    input,
    quality: {
      ...quality,
      score: Math.max(0, Math.round(100 - quality.clippingRatio * 1_000 - quality.silenceRatio * 25)),
    },
    acousticFeatures: dsp,
    modelOutputs: null,
    practiceGoal,
    recommendations: recommendations(quality, dsp, practiceGoal),
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
    pauseRatio: result.quality.pauseRatio,
    volumeVariation: result.quality.volumeVariation,
    zeroCrossingRateHz: result.quality.zeroCrossingRateHz,
    f0MedianHz: result.acousticFeatures.f0MedianHz ?? "",
    f0MeanHz: result.acousticFeatures.f0MeanHz ?? "",
    f0StdDevHz: result.acousticFeatures.f0StdDevHz ?? "",
    f0P05Hz: result.acousticFeatures.f0P05Hz ?? "",
    f0P95Hz: result.acousticFeatures.f0P95Hz ?? "",
    f0SemitoneRange: result.acousticFeatures.f0SemitoneRange ?? "",
    f0Stability: result.acousticFeatures.f0Stability ?? "",
    spectralCentroidHz: result.acousticFeatures.spectralCentroidHz ?? "",
    spectralBandwidthHz: result.acousticFeatures.spectralBandwidthHz ?? "",
    spectralRolloff85Hz: result.acousticFeatures.spectralRolloff85Hz ?? "",
    spectralRolloff95Hz: result.acousticFeatures.spectralRolloff95Hz ?? "",
    spectralFlatness: result.acousticFeatures.spectralFlatness ?? "",
    hnrDb: result.acousticFeatures.hnrDb ?? "",
  };
  return `${Object.keys(values).join(",")}\n${Object.values(values).join(",")}\n`;
}
