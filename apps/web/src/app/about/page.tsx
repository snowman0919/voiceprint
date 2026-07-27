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
        현재 버전은 로컬 DSP 측정 기능을 제공합니다. TIS 모델이 포함된 배포에서는 화자가 신뢰감을 의도한 녹음 조건의
        한정된 경향을 추가로 표시할 수 있습니다. 이는 실제 신뢰성, 성격 또는 의도의 판정이 아닙니다.
      </p>
    </main>
  );
}
