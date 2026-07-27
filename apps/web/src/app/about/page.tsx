import Link from "next/link";
import { brand } from "@/lib/brand";

export default function AboutPage() {
  return <main className="document"><Link href="/">{brand.name}</Link><p className="eyebrow">서비스 소개</p><h1>기기 안에서 확인하는 음향 측정</h1><p>{brand.description}</p><p>현재 버전은 로컬 DSP 측정 기능을 제공합니다. 학습 데이터 라이선스와 모델 검증이 끝나기 전에는 인상 예측 모델을 배포하지 않습니다.</p></main>;
}
