"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { allowsAutoDownload, cachedModel, downloadAndVerify, loadManifest, type ModelEntry } from "@/lib/model-cache";
import type { InferenceBackend } from "@/lib/inference";

type Status = "loading" | "unavailable" | "ready" | "downloading" | "error";

export function ModelStatus() {
  const [status, setStatus] = useState<Status>("loading");
  const [model, setModel] = useState<ModelEntry>();
  const [received, setReceived] = useState(0);
  const [error, setError] = useState<string>();
  const [backend, setBackend] = useState<InferenceBackend>();
  const abort = useRef<AbortController | null>(null);

  const startLocalSession = useCallback(async (active: ModelEntry, signal?: AbortSignal) => {
    const worker = new Worker(new URL("../../workers/model.worker.ts", import.meta.url));
    return new Promise<void>((resolve, reject) => {
      const stop = () => {
        worker.terminate();
        reject(new DOMException("모델 준비가 취소되었습니다.", "AbortError"));
      };
      if (signal?.aborted) return stop();
      signal?.addEventListener("abort", stop, { once: true });
      worker.onmessage = ({
        data,
      }: MessageEvent<{ type: "ready"; backend: InferenceBackend } | { type: "error"; message: string }>) => {
        signal?.removeEventListener("abort", stop);
        worker.terminate();
        if (data.type === "ready") {
          setBackend(data.backend);
          resolve();
        } else reject(new Error(data.message));
      };
      worker.onerror = () => {
        signal?.removeEventListener("abort", stop);
        worker.terminate();
        reject(new Error("이 기기에서 분석 모델을 시작할 수 없습니다."));
      };
      worker.postMessage({ type: "warm", model: active });
    });
  }, []);

  const download = useCallback(
    async (active: ModelEntry) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setStatus("downloading");
      setReceived(0);
      setError(undefined);
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            await downloadAndVerify(active, setReceived, controller.signal);
            break;
          } catch (reason) {
            if (controller.signal.aborted || attempt === 1) throw reason;
          }
        }
        await startLocalSession(active, controller.signal);
        setStatus("ready");
      } catch (reason) {
        if (controller.signal.aborted) {
          setStatus("unavailable");
          return;
        }
        setError(reason instanceof Error ? reason.message : "모델 준비에 실패했습니다.");
        setStatus("error");
      }
    },
    [startLocalSession],
  );

  useEffect(() => {
    void loadManifest()
      .then(async (manifest) => {
        const active = manifest.models.find((entry) => entry.id === manifest.activeModel);
        if (!active) {
          setStatus("unavailable");
          return;
        }
        setModel(active);
        if (await cachedModel(active)) {
          const controller = new AbortController();
          abort.current = controller;
          await startLocalSession(active, controller.signal);
          setStatus("ready");
          return;
        }
        setStatus("unavailable");
        const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
        if (allowsAutoDownload(connection?.saveData)) void download(active);
      })
      .catch((reason: Error) => {
        setError(reason.message);
        setStatus("error");
      });
    return () => abort.current?.abort();
  }, [download, startLocalSession]);

  if (status === "loading")
    return (
      <section aria-label="분석 모델 상태" className="model-status">
        <strong>분석 모델 확인 중</strong>
        <p>음성은 이 기기를 벗어나지 않습니다.</p>
      </section>
    );
  if (status === "unavailable" && !model)
    return (
      <section aria-label="분석 모델 상태" className="model-status">
        <strong>배포 모델 준비 전</strong>
        <p>학습 데이터 라이선스 검증 뒤 모델을 배포합니다. 현재 음향 측정은 이 기기에서 사용할 수 있습니다.</p>
      </section>
    );
  if (status === "unavailable")
    return (
      <section aria-label="분석 모델 상태" className="model-status">
        <strong>분석 모델 다운로드 가능</strong>
        <p>{((model?.size ?? 0) / 1_000_000).toFixed(1)} MB · 이 기기에만 저장합니다.</p>
        <button onClick={() => model && void download(model)} type="button">
          분석 모델 받기
        </button>
      </section>
    );
  if (status === "ready")
    return (
      <section aria-label="분석 모델 상태" className="model-status">
        <strong>분석 모델 준비 완료</strong>
        <p>
          이 기기에 캐시됨 · {model?.version} · {backend === "webgpu" ? "GPU" : "CPU/WASM"}
        </p>
      </section>
    );
  if (status === "downloading")
    return (
      <section aria-label="분석 모델 상태" className="model-status">
        <strong>분석 모델 준비 중</strong>
        <p>
          {(received / 1_000_000).toFixed(1)} MB / {((model?.size ?? 0) / 1_000_000).toFixed(1)} MB
        </p>
        <button onClick={() => abort.current?.abort()} type="button">
          취소
        </button>
      </section>
    );
  return (
    <section aria-label="분석 모델 상태" className="model-status">
      <strong>모델 준비 실패</strong>
      <p>{error}</p>
      {model && (
        <button onClick={() => void download(model)} type="button">
          다시 시도
        </button>
      )}
    </section>
  );
}
