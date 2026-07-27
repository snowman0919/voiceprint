export type ModelEntry = { id: string; version: string; url: string; size: number; sha256: string; inputSampleRate: number; inputSeconds: number; opset: number; quantization: string; minimumAppVersion: string };
export type ModelManifest = { schemaVersion: 1; activeModel: string | null; models: ModelEntry[] };

const cacheName = "voiceprint-models-v1";

export function allowsAutoDownload(saveData: boolean | undefined) {
  return saveData !== true;
}

export function validateManifest(value: unknown): value is ModelManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<ModelManifest>;
  return manifest.schemaVersion === 1 && (typeof manifest.activeModel === "string" || manifest.activeModel === null) && Array.isArray(manifest.models) && manifest.models.every((model) => typeof model.id === "string" && typeof model.version === "string" && typeof model.url === "string" && Number.isInteger(model.size) && /^[a-f0-9]{64}$/i.test(model.sha256));
}

export async function loadManifest() {
  const response = await fetch("/model-manifest.json", { cache: "no-store" });
  const manifest: unknown = await response.json();
  if (!response.ok || !validateManifest(manifest)) throw new Error("모델 manifest 형식이 올바르지 않습니다.");
  return manifest;
}

export async function cachedModel(model: ModelEntry) {
  return (await caches.open(cacheName)).match(model.url);
}

export async function cachedModelBytes(model: ModelEntry) {
  const response = await cachedModel(model);
  if (!response) throw new Error("검증된 로컬 모델이 없습니다.");
  return response.arrayBuffer();
}

export async function clearModelCache() { await caches.delete(cacheName); }

function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join(""); }

export async function downloadAndVerify(model: ModelEntry, onProgress: (received: number) => void, signal?: AbortSignal) {
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
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.length; });
  if (hex(await crypto.subtle.digest("SHA-256", bytes)) !== model.sha256.toLowerCase()) throw new Error("모델 무결성 검증에 실패했습니다.");
  const verified = new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } });
  await (await caches.open(cacheName)).put(model.url, verified);
}
