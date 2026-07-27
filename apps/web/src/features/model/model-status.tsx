"use client";

import { useEffect, useState } from "react";
import { cachedModel, downloadAndVerify, loadManifest, type ModelEntry } from "@/lib/model-cache";

type Status = "loading" | "unavailable" | "ready" | "downloading" | "error";

export function ModelStatus() {
  const [status, setStatus] = useState<Status>("loading");
  const [model, setModel] = useState<ModelEntry>();
  const [received, setReceived] = useState(0);
  const [error, setError] = useState<string>();
  useEffect(() => {
    void loadManifest().then(async (manifest) => {
      const active = manifest.models.find((entry) => entry.id === manifest.activeModel);
      if (!active) { setStatus("unavailable"); return; }
      setModel(active);
      setStatus((await cachedModel(active)) ? "ready" : "unavailable");
    }).catch((reason: Error) => { setError(reason.message); setStatus("error"); });
  }, []);
  async function download() {
    if (!model) return;
    setStatus("downloading"); setReceived(0);
    try { await downloadAndVerify(model, setReceived); setStatus("ready"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "모델 준비에 실패했습니다."); setStatus("error"); }
  }
  if (status === "loading") return <section aria-label="분석 모델 상태" className="model-status"><strong>분석 모델 확인 중</strong><p>음성은 이 기기를 벗어나지 않습니다.</p></section>;
  if (status === "unavailable" && !model) return <section aria-label="분석 모델 상태" className="model-status"><strong>배포 모델 준비 전</strong><p>학습 데이터 라이선스 검증 뒤 모델을 배포합니다. 현재 음향 측정은 이 기기에서 사용할 수 있습니다.</p></section>;
  if (status === "unavailable") return <section aria-label="분석 모델 상태" className="model-status"><strong>분석 모델 다운로드 가능</strong><p>{((model?.size ?? 0) / 1_000_000).toFixed(1)} MB · 이 기기에만 저장합니다.</p><button onClick={() => void download()} type="button">분석 모델 받기</button></section>;
  if (status === "ready") return <section aria-label="분석 모델 상태" className="model-status"><strong>분석 모델 준비 완료</strong><p>이 기기에 캐시됨 · {model?.version}</p></section>;
  if (status === "downloading") return <section aria-label="분석 모델 상태" className="model-status"><strong>분석 모델 준비 중</strong><p>{(received / 1_000_000).toFixed(1)} MB / {((model?.size ?? 0) / 1_000_000).toFixed(1)} MB</p></section>;
  return <section aria-label="분석 모델 상태" className="model-status"><strong>모델 준비 실패</strong><p>{error}</p>{model && <button onClick={() => void download()} type="button">다시 시도</button>}</section>;
}
