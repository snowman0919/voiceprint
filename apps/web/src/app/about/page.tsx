import Link from "next/link";
import { brand } from "@/lib/brand";

export default function AboutPage() {
  return (
    <main className="document">
      <Link href="/">{brand.name}</Link>
      <p className="eyebrow">서비스 소개</p>
      <h1>기기 안에서 확인하는 음향 측정</h1>
      <p>{brand.description}</p>
      <p>
        현재 버전은 로컬 DSP 측정과 규칙 기반 음성 인상 지표를 제공합니다. TIS 모델은 개발 중 ONNX 파이프라인 기준선이며
        사용자 보고서에 표시하지 않습니다.
      </p>
    </main>
  );
}
