export const minimumRangeSeconds = 30;
export const maximumRangeSeconds = 60;

export function normalizeRange(duration: number, start: number, length: number) {
  const safeLength = Math.min(maximumRangeSeconds, Math.max(minimumRangeSeconds, length), duration);
  const safeStart = Math.min(Math.max(0, start), Math.max(0, duration - safeLength));
  return { start: safeStart, length: safeLength };
}
