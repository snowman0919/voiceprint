export type ModelEntry = {
  id: string;
  version: string;
  url: string;
  size: number;
  sha256: string;
  inputSampleRate: number;
  inputSeconds: number;
  opset: number;
  quantization: string;
  minimumAppVersion: string;
  /** True only after the data audit and held-out evaluation approve this report purpose. */
  reportEligible: boolean;
  task?: "tis-intent";
  reportEvidenceSha256?: string;
  /** Present only for an active model with independently verified annotation and release rights. */
  releaseRights?: {
    annotationLicenseVerified: true;
    trainingAllowed: true;
    modelDistributionAllowed: true;
    publicServiceAllowed: true;
  };
};
export type ModelManifest = { schemaVersion: 1; activeModel: string | null; models: ModelEntry[] };

export const modelCacheName = "voiceprint-models-v1";

function requireCacheStorage() {
  if (!globalThis.caches) throw new Error("이 브라우저는 모델 저장소(Cache Storage)를 지원하지 않습니다.");
  return globalThis.caches;
}

function requireSubtleCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error("이 브라우저는 모델 무결성 검증(Web Crypto)을 지원하지 않습니다.");
  return globalThis.crypto.subtle;
}

export function allowsAutoDownload(saveData: boolean | undefined) {
  return saveData !== true;
}

export function validateManifest(value: unknown): value is ModelManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<ModelManifest>;
  if (
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.models) ||
    (typeof manifest.activeModel !== "string" && manifest.activeModel !== null)
  )
    return false;
  const validModel = (model: unknown): model is ModelEntry => {
    if (!model || typeof model !== "object") return false;
    const entry = model as Partial<ModelEntry>;
    return (
      typeof entry.id === "string" &&
      entry.id.length > 0 &&
      typeof entry.version === "string" &&
      entry.version.length > 0 &&
      typeof entry.url === "string" &&
      entry.url.startsWith("/models/") &&
      typeof entry.size === "number" &&
      Number.isInteger(entry.size) &&
      entry.size > 0 &&
      typeof entry.sha256 === "string" &&
      /^[a-f0-9]{64}$/i.test(entry.sha256) &&
      typeof entry.inputSampleRate === "number" &&
      Number.isInteger(entry.inputSampleRate) &&
      entry.inputSampleRate > 0 &&
      typeof entry.inputSeconds === "number" &&
      Number.isInteger(entry.inputSeconds) &&
      entry.inputSeconds > 0 &&
      entry.inputSeconds <= 60 &&
      typeof entry.opset === "number" &&
      Number.isInteger(entry.opset) &&
      entry.opset > 0 &&
      typeof entry.quantization === "string" &&
      entry.quantization.length > 0 &&
      typeof entry.minimumAppVersion === "string" &&
      entry.minimumAppVersion.length > 0 &&
      typeof entry.reportEligible === "boolean"
      && (entry.task === undefined || entry.task === "tis-intent")
    );
  };
  return (
    manifest.models.every(validModel) &&
    (manifest.activeModel === null ||
      manifest.models.some(
        (model) =>
          model.id === manifest.activeModel &&
          model.reportEligible &&
          typeof model.reportEvidenceSha256 === "string" &&
          /^[a-f0-9]{64}$/i.test(model.reportEvidenceSha256) &&
          model.releaseRights?.annotationLicenseVerified === true &&
          model.releaseRights.trainingAllowed === true &&
          model.releaseRights.modelDistributionAllowed === true &&
          model.releaseRights.publicServiceAllowed === true,
      ))
  );
}

export async function loadManifest() {
  const response = await fetch("/model-manifest.json", { cache: "no-store" });
  const manifest: unknown = await response.json();
  if (!response.ok || !validateManifest(manifest)) throw new Error("모델 manifest 형식이 올바르지 않습니다.");
  return manifest;
}

export async function cachedModel(model: Pick<ModelEntry, "url">) {
  return (await requireCacheStorage().open(modelCacheName)).match(model.url);
}

export async function cachedModelBytes(model: Pick<ModelEntry, "url">) {
  const response = await cachedModel(model);
  if (!response) throw new Error("검증된 로컬 모델이 없습니다.");
  return response.arrayBuffer();
}

export async function clearModelCache() {
  await requireCacheStorage().delete(modelCacheName);
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function downloadAndVerify(
  model: ModelEntry,
  onProgress: (received: number) => void,
  signal?: AbortSignal,
) {
  const storage = requireCacheStorage();
  const subtle = requireSubtleCrypto();
  const response = await fetch(model.url, { signal, cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("모델을 내려받을 수 없습니다.");
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received);
  }
  if (received !== model.size) throw new Error("모델 크기가 manifest와 일치하지 않습니다.");
  const bytes = new Uint8Array(received);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  if (hex(await subtle.digest("SHA-256", bytes)) !== model.sha256.toLowerCase())
    throw new Error("모델 무결성 검증에 실패했습니다.");
  const verified = new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } });
  await (await storage.open(modelCacheName)).put(model.url, verified);
}
