import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata = { title: `개인정보처리방침 | ${brand.name}` };

export default function PrivacyPage() {
  return (
    <main className="document">
      <Link href="/">{brand.name}</Link>
      <p className="eyebrow">개인정보처리방침</p>
      <h1>개인용 Voiceprint 개인정보처리방침</h1>
      <p>
        시행일: {brand.privacy.effectiveDate} · 최종 변경일: {brand.privacy.effectiveDate}
      </p>
      <p className="warning">
        운영자 실명·연락처가 확정되기 전에는 이 문서만으로 법적 고지 요건 충족을 주장할 수 없습니다. 실제 외부 제공 전
        배포 정보로 교체하고 법률 검토를 받으세요.
      </p>
      <section>
        <h2>개인정보처리자와 문의처</h2>
        <p>
          개인정보처리자: {brand.privacy.controllerName} · 문의처: {brand.privacy.contact}. 개인정보 처리 목적,
          열람·삭제 요청 및 고충 처리는 이 문의처로 접수합니다.
        </p>
      </section>
      <section>
        <h2>처리 목적과 항목</h2>
        <p>
          서비스는 결과 재조회와 사용자가 생성한 공유 링크 제공을 위해 무작위 복구 ID, 결과 생성 시각, 오락용 인상 요약,
          F0·스펙트럼·품질 등 스칼라 측정값을 처리합니다. 계정, 이름, 연락처, 브라우저 지문은 수집하지 않습니다.
        </p>
      </section>
      <section>
        <h2>처리 방식과 전송 범위</h2>
        <p>
          원본 음성, PCM, 파형, 프레임별 배열, 마이크 기기명과 브라우저 지문은 운영 서버로 전송하지 않습니다. 측정이
          끝난 뒤 결과 요약과 스칼라 음향 수치만 SQLite 저장소로 전송합니다. 분석 자체는 브라우저의 AudioWorklet, Web
          Worker, WebAssembly에서 수행됩니다.
        </p>
      </section>
      <section>
        <h2>보유 기간과 파기</h2>
        <p>
          녹음과 분석용 PCM은 분석 직후 브라우저 메모리에서 폐기합니다. 결과 재조회용으로 브라우저에 무작위 복구 ID를
          저장하고, 서버 SQLite에는 결과 요약만 저장합니다. 이 ID는 브라우저·기기 지문이 아닙니다. 저장 결과는
          생성일로부터 {brand.privacy.retentionDays}일 뒤 자동 파기되며, 결과 화면의 삭제 기능으로 먼저 삭제할 수
          있습니다.
        </p>
      </section>
      <section>
        <h2>제3자 제공·처리위탁·국외 이전</h2>
        <p>
          현재 애플리케이션은 결과를 제3자에게 제공하거나 광고·분석 SDK에 위탁하지 않습니다. 운영자가 별도 호스팅 또는
          백업 서비스를 도입하면 제공·위탁·국외 이전 여부, 수탁자와 보유 기간을 이 방침에 사전 반영합니다.
        </p>
      </section>
      <section>
        <h2>정보주체의 권리</h2>
        <p>
          사용자는 자신의 브라우저에서 결과를 삭제할 수 있고, 복구 ID를 보유한 경우 저장 결과의 열람·정정·삭제를 요청할
          수 있습니다. 공유 링크는 비밀 토큰을 아는 사람이 열 수 있으므로 필요한 경우 즉시 저장 결과를 삭제하세요.
        </p>
      </section>
      <section>
        <h2>마이크 권한</h2>
        <p>
          마이크는 사용자가 녹음 시작을 누르고 브라우저 권한을 허용한 경우에만 사용합니다. 권한은 브라우저 설정에서
          철회할 수 있습니다.
        </p>
      </section>
      <section>
        <h2>분석의 한계와 보호조치</h2>
        <p>
          결과는 의료 진단, 신원 확인, 실제 성별·성 정체성·연령·성격의 확정이 아닙니다. 로컬 ONNX 파이프라인 기준선인
          TIS 모델은 영어 연구 녹음에서 화자가 신뢰감을 의도한 조건과 중립 조건을 구분한 제한적 개발용 모델이며 사용자
          결과에는 표시하지 않습니다.
        </p>
      </section>
      <section>
        <h2>추적 도구와 변경 고지</h2>
        <p>
          기본 구현에는 광고 SDK, Google Analytics, Meta Pixel, 세션 리플레이, fingerprinting, 음성 telemetry를 넣지
          않습니다. 방침을 바꿀 경우 시행일과 변경 내용을 이 페이지에 고지합니다.
        </p>
      </section>
    </main>
  );
}
