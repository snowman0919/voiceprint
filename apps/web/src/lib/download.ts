import type { LocalAnalysis } from "./results";

function save(blob: Blob, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export function downloadText(text: string, filename: string, type: string) {
  save(new Blob([text], { type }), filename);
}

export function downloadSummaryPng(result: LocalAnalysis) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(2, 2);
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, 700, 450);
  context.fillStyle = "#14213d";
  context.font = "700 38px Arial";
  context.fillText("Voiceprint", 48, 68);
  context.font = "400 18px Arial";
  context.fillStyle = "#52606d";
  context.fillText("로컬 음향 측정 요약 · 학습 모델 미배포", 48, 102);
  context.fillStyle = "#14213d";
  context.font = "700 26px Arial";
  const rows = [["F0 중앙값", `${Math.round(result.acousticFeatures.f0MedianHz ?? 0)}Hz`], ["스펙트럼 중심", `${Math.round(result.acousticFeatures.spectralCentroidHz ?? 0)}Hz`], ["유성음", `${Math.round(result.quality.voicedRatio * 100)}%`], ["입력 품질", `${result.quality.score}`]];
  rows.forEach(([label, value], index) => { const y = 170 + index * 60; context.fillText(label, 48, y); context.fillText(value, 440, y); });
  context.font = "400 14px Arial";
  context.fillStyle = "#52606d";
  context.fillText(`생성일 ${result.createdAt.slice(0, 10)} · DSP ${result.dspVersion}`, 48, 414);
  canvas.toBlob((blob) => { if (blob) save(blob, "voiceprint-summary.png"); }, "image/png");
}
