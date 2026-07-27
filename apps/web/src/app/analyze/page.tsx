import Link from "next/link";
import { brand } from "@/lib/brand";
import { DeviceStatus } from "@/features/device/device-status";
import { Recorder } from "@/features/recording/recorder";

export default function AnalyzePage() {
  return <main className="document"><Link href="/">{brand.name}</Link><p className="eyebrow">분석</p><h1>음성을 준비하세요.</h1><DeviceStatus /><Recorder /></main>;
}
