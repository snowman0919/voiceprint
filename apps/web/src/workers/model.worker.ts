import { createOnDeviceSession, runOnDeviceInference, warmUpOnDeviceSession } from "@/lib/inference";
import { cachedModelBytes, type ModelEntry } from "@/lib/model-cache";

type Request =
  | { type: "warm"; model: Pick<ModelEntry, "url" | "inputSampleRate" | "inputSeconds"> }
  | {
      type: "infer";
      model: Pick<ModelEntry, "url" | "inputSampleRate" | "inputSeconds">;
      pcm: ArrayBuffer;
      sampleRate: number;
    };

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const session = await createOnDeviceSession(await cachedModelBytes(data.model));
    if (data.type === "warm") {
      await warmUpOnDeviceSession(session, data.model.inputSampleRate, data.model.inputSeconds);
      self.postMessage({ type: "ready", backend: session.backend });
      return;
    }
    const source = new Float32Array(data.pcm);
    const wasm = await import("@/generated/voice_dsp.js");
    await wasm.default(new URL("/wasm/voice_dsp_bg.wasm", self.location.origin));
    const modelPcm =
      data.sampleRate === data.model.inputSampleRate
        ? source
        : wasm.resample_to_rate(source, data.sampleRate, data.model.inputSampleRate);
    const result = await runOnDeviceInference(session, modelPcm, data.model.inputSampleRate, data.model.inputSeconds);
    self.postMessage({ type: "result", backend: session.backend, ...result });
  } catch (err) {
    const describe = (e: unknown, depth = 0): string => {
      if (depth > 4 || e == null) return "";
      const head = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      const cause = e instanceof Error ? (e as { cause?: unknown }).cause : undefined;
      return head + (cause ? ` <= ${describe(cause, depth + 1)}` : "");
    };
    const message = describe(err);
    console.error("[model.worker] session failed:", message, err);
    self.postMessage({ type: "error", message: `이 기기에서 분석 모델을 시작할 수 없습니다. (${message})` });
  }
};
