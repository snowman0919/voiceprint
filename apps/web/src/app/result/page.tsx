"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { decodeSharedResult, type SharedResultV1 } from "@/lib/share";
import { brand } from "@/lib/brand";
import { reviewDemoResult } from "@/lib/review-demo";

export default function ResultPage() {
  const [result, setResult] = useState<SharedResultV1>();
  const [error, setError] = useState<string>();
  const [isReviewDemo, setIsReviewDemo] = useState(false);
  useEffect(() => {
    const payload = new URLSearchParams(window.location.hash.slice(1)).get("r") ?? "";
    if (!payload) {
      setResult(reviewDemoResult);
      setIsReviewDemo(true);
      return;
    }
    void decodeSharedResult(payload)
      .then((decoded) => {
        setResult(decoded);
        setIsReviewDemo(false);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);
  if (error)
    return (
      <main className="document">
        <Link href="/">{brand.name}</Link>
        <h1>공유 결과를 열 수 없습니다.</h1>
        <p>{error}</p>
      </main>
    );
  if (!result)
    return (
      <main className="document">
        <p role="status">공유 결과를 읽는 중…</p>
      </main>
    );
  return (
    <main className="document">
      <Link href="/">{brand.name}</Link>
      <p className="eyebrow">{isReviewDemo ? "검토용 예시" : "공유된 요약"}</p>
      <h1>{isReviewDemo ? "결과 화면 미리보기" : "음향적 경향"}</h1>
      <p>
        {isReviewDemo
          ? "이 화면은 레이아웃을 검토하기 위한 합성 수치 예시입니다. 학습 데이터와 실제 음성은 사용하지 않습니다."
          : "이 결과는 공유 링크에 포함된 측정 요약입니다. 원본 음성은 포함되어 있지 않습니다."}
      </p>
      <p className="safety">
        음성 특징 기반의 오락용 인상 지표입니다. 성별·성 정체성·성격을 판정하지 않으며, 녹음 조건과 발화 상황에 따라
        달라질 수 있습니다. ‘남성성’과 ‘여성성’은 우열이나 고정된 기준이 아닌 연속적인 표현 경향을 설명하기 위한 친숙한
        표현입니다.
      </p>
      <dl className="quality">
        {result.summary && (
          <>
            <div>
              <dt>남성성</dt>
              <dd>{result.summary.masculinity}%</dd>
            </div>
            <div>
              <dt>여성성</dt>
              <dd>{result.summary.femininity}%</dd>
            </div>
            <div>
              <dt>밝은 음색</dt>
              <dd>{result.summary.brightness}%</dd>
            </div>
            <div>
              <dt>높이 안정성</dt>
              <dd>{result.summary.stability}%</dd>
            </div>
          </>
        )}
        {result.acoustic.f0Median !== undefined && (
          <div>
            <dt>F0 중앙값</dt>
            <dd>{result.acoustic.f0Median}Hz</dd>
          </div>
        )}
        <div>
          <dt>입력 품질</dt>
          <dd>{result.quality.score}</dd>
        </div>
      </dl>
      <p>공유 결과는 링크 작성자가 수정할 수 있으며 공식 인증 결과가 아닙니다.</p>
      {isReviewDemo && (
        <Link className="primary-link" href="/analyze">
          내 목소리로 측정하기
        </Link>
      )}
    </main>
  );
}
