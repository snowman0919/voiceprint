export type AudioQuality = {
  durationSeconds: number;
  rms: number;
  peak: number;
  clippingRatio: number;
  dcOffset: number;
  silenceRatio: number;
  voicedRatio: number;
  issues: string[];
};

const FRAME_SAMPLES = 480;

export function inspectAudio(pcm: Float32Array, sampleRate: number): AudioQuality {
  let sumSquares = 0;
  let sum = 0;
  let peak = 0;
  let clipped = 0;
  let quietFrames = 0;
  let voicedFrames = 0;
  const frameCount = Math.ceil(pcm.length / FRAME_SAMPLES);

  for (let start = 0; start < pcm.length; start += FRAME_SAMPLES) {
    const end = Math.min(start + FRAME_SAMPLES, pcm.length);
    let frameSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = pcm[index];
      const magnitude = Math.abs(sample);
      sumSquares += sample * sample;
      sum += sample;
      frameSquares += sample * sample;
      peak = Math.max(peak, magnitude);
      if (magnitude >= 0.99) clipped += 1;
    }
    const frameRms = Math.sqrt(frameSquares / (end - start));
    if (frameRms < 0.006) quietFrames += 1;
    if (frameRms >= 0.015) voicedFrames += 1;
  }

  const durationSeconds = pcm.length / sampleRate;
  const rms = Math.sqrt(sumSquares / Math.max(pcm.length, 1));
  const clippingRatio = clipped / Math.max(pcm.length, 1);
  const issues: string[] = [];
  if (durationSeconds < 7.99) issues.push("유효 음성이 8초보다 짧습니다.");
  if (rms < 0.01) issues.push("입력 음량이 너무 작습니다.");
  if (clippingRatio > 0.01) issues.push("clipping이 큽니다.");
  if (voicedFrames / Math.max(frameCount, 1) < 0.2) issues.push("유성음이 부족합니다.");

  return {
    durationSeconds,
    rms,
    peak,
    clippingRatio,
    dcOffset: sum / Math.max(pcm.length, 1),
    silenceRatio: quietFrames / Math.max(frameCount, 1),
    voicedRatio: voicedFrames / Math.max(frameCount, 1),
    issues,
  };
}
