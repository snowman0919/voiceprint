import { createOnDeviceSession, warmUpOnDeviceSession } from "@/lib/inference";
import { modelCacheName, type ModelEntry } from "@/lib/model-cache";

type Request = { model: Pick<ModelEntry, "url" | "inputSampleRate" | "inputSeconds"> };

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const response = await (await caches.open(modelCacheName)).match(data.model.url);
    if (!response) throw new Error("검증된 로컬 모델이 없습니다.");
    const session = await createOnDeviceSession(await response.arrayBuffer());
    await warmUpOnDeviceSession(session, data.model.inputSampleRate, data.model.inputSeconds);
    self.postMessage({ type: "ready", backend: session.backend });
  } catch {
    self.postMessage({ type: "error", message: "이 기기에서 분석 모델을 시작할 수 없습니다." });
  }
};
