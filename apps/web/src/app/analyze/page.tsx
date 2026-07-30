import Link from "next/link";
import { brand } from "@/lib/brand";
import { DeviceStatus } from "@/features/device/device-status";
import { Recorder } from "@/features/recording/recorder";

export default function AnalyzePage() {
  return (
    <main className="document">
      <Link href="/">{brand.name}</Link>
      <p className="eyebrow">분석</p>
      <h1>한 문장으로 목소리 흐름을 확인하세요.</h1>
      <p className="lead">30초 이상, 평소처럼 읽으면 됩니다. 녹음과 측정은 이 기기에서 처리됩니다.</p>
      <DeviceStatus />
      <Recorder />
    </main>
  );
}
