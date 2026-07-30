export type AudioQuality = {
  durationSeconds: number;
  rms: number;
  peak: number;
  clippingRatio: number;
  dcOffset: number;
  silenceRatio: number;
  pauseRatio: number;
  voicedRatio: number;
  volumeVariation: number;
  zeroCrossingRateHz: number;
  estimatedSnrDb?: number;
  droppedFrames: boolean;
  issues: string[];
};

export function inspectAudio(pcm: Float32Array, sampleRate: number, droppedFrames = false): AudioQuality {
  let sumSquares = 0;
  let sum = 0;
  let peak = 0;
  let clipped = 0;
  let quietFrames = 0;
  let voicedFrames = 0;
  let zeroCrossings = 0;
  let previous = 0;
  const frameSamples = Math.max(1, Math.round(sampleRate * 0.02));
  const frameRmsValues: number[] = [];
  const frameCount = Math.ceil(pcm.length / frameSamples);

  for (let start = 0; start < pcm.length; start += frameSamples) {
    const end = Math.min(start + frameSamples, pcm.length);
    let frameSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = pcm[index];
      if (index > 0 && sample >= 0 !== previous >= 0) zeroCrossings += 1;
      previous = sample;
      const magnitude = Math.abs(sample);
      sumSquares += sample * sample;
      sum += sample;
      frameSquares += sample * sample;
      peak = Math.max(peak, magnitude);
      if (magnitude >= 0.99) clipped += 1;
    }
    const frameRms = Math.sqrt(frameSquares / (end - start));
    frameRmsValues.push(frameRms);
    if (frameRms < 0.006) quietFrames += 1;
    if (frameRms >= 0.015) voicedFrames += 1;
  }

  const durationSeconds = pcm.length / sampleRate;
  const rms = Math.sqrt(sumSquares / Math.max(pcm.length, 1));
  const clippingRatio = clipped / Math.max(pcm.length, 1);
  const quiet = frameRmsValues.filter((value) => value < 0.006);
  const voiced = frameRmsValues.filter((value) => value >= 0.015);
  const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const estimatedSnrDb =
    quiet.length && voiced.length
      ? 20 * Math.log10(Math.max(average(voiced), 1e-8) / Math.max(average(quiet), 1e-8))
      : undefined;
  const frameMean = average(frameRmsValues);
  const volumeVariation =
    frameMean > 0
      ? Math.sqrt(
          frameRmsValues.reduce((total, value) => total + (value - frameMean) ** 2, 0) / frameRmsValues.length,
        ) / frameMean
      : 0;
  const issues: string[] = [];
  if (durationSeconds < 30) issues.push("유효 음성이 30초보다 짧습니다. 표준 문장을 끝까지 읽은 뒤 다시 측정하세요.");
  if (durationSeconds > 60) issues.push("60초를 초과한 파일은 구간을 선택한 뒤 다시 시도하세요.");
  if (rms < 0.01) issues.push("입력 음량이 너무 작습니다.");
  if (clippingRatio > 0.01) issues.push("clipping이 큽니다.");
  if (voicedFrames / Math.max(frameCount, 1) < 0.2) issues.push("유성음이 부족합니다.");
  if (estimatedSnrDb !== undefined && estimatedSnrDb < 10) issues.push("배경 소음이 큽니다.");
  if (droppedFrames) issues.push("녹음 중 오디오 프레임이 손실되었습니다.");

  return {
    durationSeconds,
    rms,
    peak,
    clippingRatio,
    dcOffset: sum / Math.max(pcm.length, 1),
    silenceRatio: quietFrames / Math.max(frameCount, 1),
    pauseRatio: quietFrames / Math.max(frameCount, 1),
    voicedRatio: voicedFrames / Math.max(frameCount, 1),
    volumeVariation,
    zeroCrossingRateHz: zeroCrossings / Math.max(durationSeconds, 1e-12),
    estimatedSnrDb,
    droppedFrames,
    issues,
  };
}
