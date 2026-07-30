"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoredResultV1 } from "@/lib/share";
import { brand } from "@/lib/brand";
import { reviewDemoResult } from "@/lib/review-demo";
import { deleteStoredResult, loadLatestResult, loadSharedResult } from "@/lib/result-store";

export default function ResultPage() {
  const [result, setResult] = useState<StoredResultV1>();
  const [error, setError] = useState<string>();
  const [isReviewDemo, setIsReviewDemo] = useState(false);
  const [resultId, setResultId] = useState<string>();
  const [isShared, setIsShared] = useState(false);
  useEffect(() => {
    const shareToken = new URLSearchParams(window.location.hash.slice(1)).get("share");
    void (shareToken ? loadSharedResult(shareToken) : loadLatestResult())
      .then((loaded) => {
        setResult(loaded.result);
        setResultId(loaded.id);
        setIsShared(Boolean(shareToken));
        setIsReviewDemo(false);
      })
      .catch((reason: Error) => {
        if (!shareToken && reason.message === "저장된 결과를 찾을 수 없습니다.") {
          setResult(reviewDemoResult);
          setIsReviewDemo(true);
          return;
        }
        setError(reason.message);
      });
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
  const masculinity = result.summary?.masculinity ?? 50;
  const femininity = result.summary?.femininity ?? 50;
  const leadingImpression =
    masculinity === femininity ? "균형적인" : masculinity > femininity ? "낮고 안정적인" : "가볍고 밝은";
  async function removeResult() {
    if (!resultId) return;
    await deleteStoredResult(resultId);
    setResult(reviewDemoResult);
    setResultId(undefined);
    setIsReviewDemo(true);
  }
  return (
    <main className="document">
      <Link href="/">{brand.name}</Link>
      <p className="eyebrow">{isReviewDemo ? "검토용 예시" : "저장된 측정 결과"}</p>
      <section className="impression-hero" aria-labelledby="impression-heading">
        <p>오락용 음성 인상</p>
        <h1 id="impression-heading">이 녹음은 {leadingImpression} 인상에 조금 더 가깝습니다.</h1>
        <div className="impression-scale" aria-label={`남성성 ${masculinity}%, 여성성 ${femininity}%`}>
          <span>남성성 {masculinity}%</span>
          <meter max="100" min="0" value={masculinity} />
          <span>여성성 {femininity}%</span>
        </div>
        <p className="impression-disclaimer">
          음성 특징 기반의 오락용 인상 지표입니다. 성별·성 정체성·성격을 판정하지 않으며, 녹음 조건과 발화 상황에 따라
          달라질 수 있습니다.
        </p>
      </section>
      <p>
        {isReviewDemo
          ? "이 화면은 레이아웃을 검토하기 위한 합성 수치 예시입니다. 학습 데이터와 실제 음성은 사용하지 않습니다."
          : "서버에는 상세 측정값 중 스칼라 수치만 저장합니다. 원본 음성·PCM·파형·프레임별 배열은 포함하지 않습니다."}
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
      {result.details && (
        <section className="result-details" aria-labelledby="details-heading">
          <h2 id="details-heading">상세 음향 분석</h2>
          <p>이 수치는 녹음에서 관측한 음향 특징이며 사람의 성격·건강·정체성을 판단하지 않습니다.</p>
          <dl className="quality">
            {result.details.durationSeconds !== undefined && (
              <div>
                <dt>분석 길이</dt>
                <dd>{result.details.durationSeconds.toFixed(1)}초</dd>
              </div>
            )}
            {result.details.f0Mean !== undefined && (
              <div>
                <dt>F0 평균</dt>
                <dd>{Math.round(result.details.f0Mean)}Hz</dd>
              </div>
            )}
            {result.details.f0SemitoneRange !== undefined && (
              <div>
                <dt>F0 범위</dt>
                <dd>{result.details.f0SemitoneRange.toFixed(1)}st</dd>
              </div>
            )}
            {result.details.f0Stability !== undefined && (
              <div>
                <dt>음높이 안정성</dt>
                <dd>{Math.round(result.details.f0Stability)}/100</dd>
              </div>
            )}
            {result.details.spectralCentroid !== undefined && (
              <div>
                <dt>스펙트럼 중심</dt>
                <dd>{Math.round(result.details.spectralCentroid)}Hz</dd>
              </div>
            )}
            {result.details.spectralBandwidth !== undefined && (
              <div>
                <dt>스펙트럼 대역폭</dt>
                <dd>{Math.round(result.details.spectralBandwidth)}Hz</dd>
              </div>
            )}
            {result.details.spectralFlatness !== undefined && (
              <div>
                <dt>스펙트럼 평탄도</dt>
                <dd>{result.details.spectralFlatness.toFixed(3)}</dd>
              </div>
            )}
            {result.details.pauseRatio !== undefined && (
              <div>
                <dt>휴지 비율</dt>
                <dd>{Math.round(result.details.pauseRatio * 100)}%</dd>
              </div>
            )}
            {result.details.estimatedSnr !== undefined && (
              <div>
                <dt>추정 SNR</dt>
                <dd>{result.details.estimatedSnr.toFixed(1)}dB</dd>
              </div>
            )}
          </dl>
        </section>
      )}
      <p>공유 링크는 비밀 토큰으로 조회합니다. 공식 인증 결과가 아니며, 원본 음성은 저장하지 않습니다.</p>
      {!isReviewDemo && !isShared && resultId && (
        <button className="secondary-action" onClick={() => void removeResult()} type="button">
          이 저장 결과 삭제
        </button>
      )}
      {isReviewDemo && (
        <Link className="primary-link" href="/analyze">
          내 목소리로 측정하기
        </Link>
      )}
    </main>
  );
}
