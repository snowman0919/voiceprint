export type InferenceBackend = "webgpu" | "wasm";

type Session = unknown;
type CreateSession = (backend: InferenceBackend) => Promise<Session>;

/**
 * WebGPU setup can fail on an otherwise capable browser (policy, driver, or
 * unsupported operator). Keep the CPU/WASM path deliberate and observable.
 */
export async function createSessionWithFallback(create: CreateSession) {
  try {
    return { backend: "webgpu" as const, session: await create("webgpu") };
  } catch (webgpuError) {
    try {
      return { backend: "wasm" as const, session: await create("wasm") };
    } catch (wasmError) {
      throw new Error("이 기기에서 분석 모델을 시작할 수 없습니다.", { cause: { webgpuError, wasmError } });
    }
  }
}

/** Creates an ONNX Runtime Web session without sending model bytes off-device. */
export async function createOnDeviceSession(modelBytes: ArrayBuffer) {
  return createSessionWithFallback(async (backend) => {
    if (backend === "webgpu") {
      const ort = await import("onnxruntime-web/webgpu");
      return ort.InferenceSession.create(modelBytes, { executionProviders: ["webgpu"] });
    }
    const ort = await import("onnxruntime-web/wasm");
    return ort.InferenceSession.create(modelBytes, { executionProviders: ["wasm"] });
  });
}
