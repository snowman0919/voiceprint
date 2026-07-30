import type { StoredResultV1 } from "./share";

const recoveryIdKey = "voiceprint.result-recovery-id.v1";

export type SavedResult = { id: string; shareToken: string; createdAt: string; expiresAt: string };
export type LoadedResult = { id: string; createdAt: string; result: StoredResultV1 };

function recoveryId() {
  const existing = window.localStorage.getItem(recoveryIdKey);
  if (existing && /^[A-Za-z0-9_-]{32,128}$/.test(existing)) return existing;
  const value = crypto.getRandomValues(new Uint8Array(24));
  const created = btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  window.localStorage.setItem(recoveryIdKey, created);
  return created;
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      response.status === 404 ? "저장된 결과를 찾을 수 없습니다." : "결과를 저장하거나 불러오지 못했습니다.",
    );
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export function saveResult(result: StoredResultV1) {
  return request<SavedResult>("/api/results", { recoveryId: recoveryId(), result });
}

export function loadLatestResult() {
  return request<LoadedResult>("/api/results/lookup", { recoveryId: recoveryId() });
}

export function loadStoredResult(resultId: string) {
  return request<LoadedResult>("/api/results/lookup", { recoveryId: recoveryId(), resultId });
}

export function listStoredResults() {
  return request<{ results: LoadedResult[] }>("/api/results/list", { recoveryId: recoveryId() });
}

export function loadSharedResult(shareToken: string) {
  return request<LoadedResult>("/api/results/share", { shareToken });
}

export function deleteStoredResult(resultId: string) {
  return request<Record<string, never>>("/api/results/delete", { recoveryId: recoveryId(), resultId });
}
