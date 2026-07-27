"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { decodeSharedResult, type SharedResultV1 } from "@/lib/share";

export default function ResultPage() {
  const [result, setResult] = useState<SharedResultV1>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const payload = new URLSearchParams(window.location.hash.slice(1)).get("r") ?? "";
    void decodeSharedResult(payload).then(setResult).catch((reason: Error) => setError(reason.message));
  }, []);
  if (error) return <main className="document"><Link href="/">Voiceprint</Link><h1>공유 결과를 열 수 없습니다.</h1><p>{error}</p></main>;
  if (!result) return <main className="document"><p role="status">공유 결과를 읽는 중…</p></main>;
  return <main className="document"><Link href="/">Voiceprint</Link><p className="eyebrow">공유된 요약</p><h1>음향적 경향</h1><p>이 결과는 공유 링크에 포함된 요약 데이터입니다. 원본 음성은 포함되어 있지 않습니다.</p><dl className="quality"><div><dt>인상 경향</dt><dd>{result.summary.impression}</dd></div><div><dt>밝은 음색</dt><dd>{result.summary.brightness}</dd></div><div><dt>부드러운 발성</dt><dd>{result.summary.softness}</dd></div><div><dt>높이 안정성</dt><dd>{result.summary.stability}</dd></div><div><dt>F0 중앙값</dt><dd>{result.acoustic.f0Median}Hz</dd></div><div><dt>입력 품질</dt><dd>{result.quality.score}</dd></div></dl><p>공유 결과는 링크 작성자가 수정할 수 있으며 공식 인증 결과가 아닙니다.</p></main>;
}
