"use client";

import { useEffect, useRef } from "react";
import type { Spectrogram as SpectrogramData } from "@/lib/dsp";

export function Spectrogram({ data }: { data: SpectrogramData }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    element.width = data.frames;
    element.height = data.bins;
    const image = context.createImageData(data.frames, data.bins);
    for (let time = 0; time < data.frames; time += 1) {
      for (let frequency = 0; frequency < data.bins; frequency += 1) {
        const level = data.levels[time * data.bins + (data.bins - frequency - 1)];
        const index = (frequency * data.frames + time) * 4;
        image.data[index] = Math.round(level * 0.2);
        image.data[index + 1] = Math.round(level * 0.65);
        image.data[index + 2] = level;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }, [data]);
  return <canvas aria-label="로그 파워 스펙트로그램" className="spectrogram" ref={canvas} role="img" />;
}
