export type InferenceBackend = "webgpu" | "wasm";
export type TendencyScores = { impression: number; brightness: number; softness: number; stability: number };
export type TisIntentScore = { score: number };

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

/** The TIS model has one bounded output: an attempted trustworthy-intent recording condition. */
export function normalizeTisIntentOutput(values: ArrayLike<number>): TisIntentScore {
  const score = values[0];
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("TIS 모델 출력 범위가 올바르지 않습니다.");
  return { score: Math.round(score * 100) };
}

/** Creates an ONNX Runtime Web session without sending model bytes off-device. */
export async function createOnDeviceSession(modelBytes: ArrayBuffer): Promise<OnDeviceSession> {
  const loaded = await createSessionWithFallback(async (backend) => {
    const ort = backend === "webgpu" ? await import("onnxruntime-web/webgpu") : await import("onnxruntime-web/wasm");
    // ponytail: wasmPaths must point at the vendored ORT wasm assets under /ort/.
    // Static export has no default module resolution path; without this the WASM
    // backend cannot locate ort-wasm-simd-threaded.{wasm,mjs} → load fails.
    // Upgrade path: bundle ORT via a loader plugin if Next adds one.
    if (backend === "wasm") ort.env.wasm.wasmPaths = "/ort/";
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
  const samples = sampleRate * seconds;
  return loaded.session.run({ waveform: loaded.tensor(new Float32Array(samples), [1, 1, samples]) });
}

export function resampleModelWindow(
  source: Float32Array,
  sourceRate: number,
  targetRate: number,
  seconds: number,
  startSeconds: number,
) {
  const targetSamples = targetRate * seconds;
  const values = new Float32Array(targetSamples);
  const start = Math.max(0, Math.min(source.length / sourceRate - seconds, startSeconds)) * sourceRate;
  const ratio = sourceRate / targetRate;
  for (let index = 0; index < targetSamples; index += 1) {
    const position = start + index * ratio;
    const lower = Math.floor(position);
    const upper = Math.min(source.length - 1, lower + 1);
    const fraction = position - lower;
    values[index] = lower >= 0 && lower < source.length ? source[lower] * (1 - fraction) + source[upper] * fraction : 0;
  }
  return values;
}

export async function runTisIntentInference(
  loaded: OnDeviceSession,
  waveform: Float32Array,
  sourceRate: number,
  targetRate: number,
  seconds: number,
) {
  const duration = waveform.length / sourceRate;
  const windowCount = Math.max(1, Math.min(3, Math.floor(duration / seconds)));
  const maximumStart = Math.max(0, duration - seconds);
  const scores: number[] = [];
  for (let index = 0; index < windowCount; index += 1) {
    const start = windowCount === 1 ? 0 : (maximumStart * index) / (windowCount - 1);
    const input = resampleModelWindow(waveform, sourceRate, targetRate, seconds, start);
    const outputs = await loaded.session.run({ waveform: loaded.tensor(input, [1, 1, input.length]) });
    const output = outputs.trustworthy_intent;
    if (!output) throw new Error("TIS 모델 출력이 없습니다.");
    scores.push(normalizeTisIntentOutput(output.data).score);
  }
  return { score: Math.round(scores.reduce((total, score) => total + score, 0) / scores.length), windows: windowCount };
}
