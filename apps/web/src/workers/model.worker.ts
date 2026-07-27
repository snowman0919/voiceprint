import { createOnDeviceSession, runTisIntentInference, warmUpOnDeviceSession } from "@/lib/inference";
import { modelCacheName, type ModelEntry } from "@/lib/model-cache";

type Request =
  | { type: "warm"; model: Pick<ModelEntry, "url" | "inputSampleRate" | "inputSeconds"> }
  | {
      type: "infer-tis";
      model: Pick<ModelEntry, "url" | "inputSampleRate" | "inputSeconds">;
      pcm: ArrayBuffer;
      sampleRate: number;
    };

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const response = await (await caches.open(modelCacheName)).match(data.model.url);
    if (!response) throw new Error("검증된 로컬 모델이 없습니다.");
    const session = await createOnDeviceSession(await response.arrayBuffer());
    if (data.type === "warm") {
      await warmUpOnDeviceSession(session, data.model.inputSampleRate, data.model.inputSeconds);
      self.postMessage({ type: "ready", backend: session.backend });
      return;
    }
    const result = await runTisIntentInference(
      session,
      new Float32Array(data.pcm),
      data.sampleRate,
      data.model.inputSampleRate,
      data.model.inputSeconds,
    );
    self.postMessage({ type: "tis-result", backend: session.backend, ...result });
  } catch {
    self.postMessage({ type: "error", message: "이 기기에서 분석 모델을 시작할 수 없습니다." });
  }
};
