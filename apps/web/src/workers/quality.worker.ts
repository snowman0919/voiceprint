import { inspectAudio } from "@/lib/audio-quality";

type Request = { pcm: ArrayBuffer; sampleRate: number };

self.onmessage = ({ data }: MessageEvent<Request>) => {
  const pcm = new Float32Array(data.pcm);
  self.postMessage(inspectAudio(pcm, data.sampleRate));
};
