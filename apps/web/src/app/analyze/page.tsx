import Link from "next/link";
import { brand } from "@/lib/brand";

export default function AnalyzePage() {
  return <main className="document"><Link href="/">{brand.name}</Link><p className="eyebrow">분석</p><h1>음성을 준비하세요.</h1><p>녹음과 로컬 파일 분석은 시작 화면에서 진행합니다.</p><Link href="/">분석 화면으로 이동</Link></main>;
}
