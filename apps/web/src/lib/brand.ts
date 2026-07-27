import { analysisConfig } from "./analysis-config";

export const brand = {
  name: "Voiceprint",
  description: "목소리의 높이, 공명, 음색과 인상 경향을 이 기기에서 분석합니다.",
  privacyPromise: "음성은 이 기기를 벗어나지 않습니다.",
  appVersion: "0.1.0",
  dspVersion: analysisConfig.version,
} as const;
