import Link from "next/link";

export const metadata = { title: "개인정보처리방침 | Voiceprint" };

export default function PrivacyPage() {
  return (
    <main className="document">
      <Link href="/">Voiceprint</Link>
      <p className="eyebrow">개인정보처리방침</p>
      <h1>음성은 이 기기를 벗어나지 않습니다.</h1>
      <p>시행일: 배포 전 확정</p>
      <section><h2>처리되는 정보</h2><p>사용자가 녹음하거나 선택한 음성, 파형, 주파수 정보, 음성학적 특징과 모델 입력값은 브라우저 안에서 처리합니다.</p></section>
      <section><h2>서버 전송</h2><p>원본 음성, PCM, 음성 특징, 임베딩, 분석 결과는 운영 서버로 전송하지 않습니다. 현재 앱은 AudioWorklet, Web Worker, WebAssembly에서 로컬 처리를 수행합니다.</p></section>
      <section><h2>저장</h2><p>현재 구현은 녹음과 분석용 PCM을 분석이 끝난 뒤 브라우저 메모리에서만 유지합니다. 모델·정적 자산 다운로드 요청에는 배포 사업자의 일반 접속 로그가 적용될 수 있습니다.</p></section>
      <section><h2>마이크 권한</h2><p>마이크는 사용자가 녹음 시작을 누르고 브라우저 권한을 허용한 경우에만 사용합니다. 권한은 브라우저 설정에서 철회할 수 있습니다.</p></section>
      <section><h2>분석의 한계</h2><p>결과는 의료 진단, 신원 확인, 실제 성별·성 정체성·연령·성격의 확정이 아닙니다. 현재는 음향 측정만 제공하며, 학습 모델이 추가되기 전까지 인상 예측을 표시하지 않습니다.</p></section>
      <section><h2>추적 도구</h2><p>기본 구현에는 광고 SDK, Google Analytics, Meta Pixel, 세션 리플레이, fingerprinting, 음성 telemetry를 넣지 않습니다.</p></section>
    </main>
  );
}
