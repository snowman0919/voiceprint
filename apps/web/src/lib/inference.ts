export type InferenceBackend = "webgpu" | "wasm";
export type TendencyScores = { impression: number; brightness: number; softness: number; stability: number };

type Session = { run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: ArrayLike<number> }>> };
type TensorFactory = (values: Float32Array, dimensions: readonly number[]) => unknown;
type CreateSession<T> = (backend: InferenceBackend) => Promise<T>;

export type OnDeviceSession = { backend: InferenceBackend; session: Session; tensor: TensorFactory };

/** WebGPU is preferred, but only a local WASM session is accepted as fallback. */
export async function createSessionWithFallback<T>(create: CreateSession<T>) {
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

export function normalizeTendencyOutput(values: ArrayLike<number>): TendencyScores {
  if (values.length < 4) throw new Error("모델 출력 차원이 올바르지 않습니다.");
  const [impression, brightness, softness, stability] = Array.from(values).slice(0, 4);
  if (
    ![impression, brightness, softness, stability].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
  )
    throw new Error("모델 출력 범위가 올바르지 않습니다.");
  return {
    impression: Math.round(impression * 100),
    brightness: Math.round(brightness * 100),
    softness: Math.round(softness * 100),
    stability: Math.round(stability * 100),
  };
}

/** Creates an ONNX Runtime Web session without sending model bytes off-device. */
export async function createOnDeviceSession(modelBytes: ArrayBuffer): Promise<OnDeviceSession> {
  const loaded = await createSessionWithFallback(async (backend) => {
    const ort = backend === "webgpu" ? await import("onnxruntime-web/webgpu") : await import("onnxruntime-web/wasm");
    const session = await ort.InferenceSession.create(modelBytes, { executionProviders: [backend] });
    return {
      session,
      tensor: (values: Float32Array, dimensions: readonly number[]) => new ort.Tensor("float32", values, dimensions),
    };
  });
  return {
    backend: loaded.backend,
    session: loaded.session.session as unknown as Session,
    tensor: loaded.session.tensor,
  };
}

export async function runOnDeviceInference(
  loaded: OnDeviceSession,
  waveform: Float32Array,
  sampleRate: number,
  seconds: number,
) {
  const expectedSamples = sampleRate * seconds;
  if (waveform.length !== expectedSamples) throw new Error("모델 입력 길이가 manifest 계약과 일치하지 않습니다.");
  const outputs = await loaded.session.run({ waveform: loaded.tensor(waveform, [1, 1, expectedSamples]) });
  const tendencies = outputs.tendencies;
  if (!tendencies) throw new Error("모델 출력 tendencies가 없습니다.");
  return normalizeTendencyOutput(tendencies.data);
}

export async function warmUpOnDeviceSession(loaded: OnDeviceSession, sampleRate: number, seconds: number) {
  return runOnDeviceInference(loaded, new Float32Array(sampleRate * seconds), sampleRate, seconds);
}
