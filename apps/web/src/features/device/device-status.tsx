"use client";

import { useEffect, useState } from "react";

export function DeviceStatus() {
  const [issues, setIssues] = useState<string[]>();
  useEffect(() => {
    const next: string[] = [];
    if (!navigator.mediaDevices?.getUserMedia) next.push("마이크 녹음을 지원하지 않습니다.");
    if (!window.AudioContext) next.push("Web Audio를 지원하지 않습니다.");
    if (!window.Worker || !window.WebAssembly) next.push("로컬 분석 엔진을 지원하지 않습니다.");
    const frame = window.requestAnimationFrame(() => setIssues(next));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  if (!issues) return <p role="status" className="metadata">기기 호환성 확인 중…</p>;
  if (!issues.length) return <p role="status" className="metadata">이 기기에서 로컬 분석을 실행할 수 있습니다.</p>;
  return <section className="error" role="alert"><strong>일부 기능을 사용할 수 없습니다.</strong><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul><p>로컬 파일 선택은 브라우저 지원 범위에서 계속 시도할 수 있습니다.</p></section>;
}
