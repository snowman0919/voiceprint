"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { brand } from "@/lib/brand";
import { clearModelCache } from "@/lib/model-cache";

export default function SettingsPage() {
  const [usage, setUsage] = useState<string>("확인 중");
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    void navigator.storage
      ?.estimate()
      .then((estimate) => setUsage(`${((estimate.usage ?? 0) / 1_000_000).toFixed(1)} MB 사용 중`));
  }, []);
  async function clear() {
    await clearModelCache();
    setMessage("모델 캐시를 삭제했습니다.");
  }
  return (
    <main className="document">
      <Link href="/">{brand.name}</Link>
      <p className="eyebrow">설정</p>
      <h1>기기 저장공간</h1>
      <section>
        <h2>분석 모델 캐시</h2>
        <p>{usage}</p>
        <button onClick={() => void clear()} type="button">
          모델 캐시 삭제
        </button>
        {message && <p role="status">{message}</p>}
      </section>
      <section>
        <h2>녹음과 결과</h2>
        <p>
          현재 구현은 분석 PCM과 결과를 기본적으로 브라우저 메모리에만 유지합니다. 원본 음성은 자동으로 저장하지
          않습니다.
        </p>
      </section>
    </main>
  );
}
