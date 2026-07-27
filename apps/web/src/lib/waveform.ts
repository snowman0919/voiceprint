/** Peak envelope preserves visible transients that average-based downsampling erases. */
export function peakEnvelope(pcm: Float32Array, buckets = 120) {
  return Array.from({ length: Math.min(buckets, pcm.length) }, (_, bucket) => {
    const start = Math.floor((bucket * pcm.length) / Math.min(buckets, pcm.length));
    const end = Math.floor(((bucket + 1) * pcm.length) / Math.min(buckets, pcm.length));
    let peak = 0;
    for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(pcm[index]));
    return peak;
  });
}
