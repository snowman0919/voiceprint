import styles from "./page.module.css";
import { Recorder } from "@/features/recording/recorder";
import Link from "next/link";
import { brand } from "@/lib/brand";

export default function Home() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>ON-DEVICE VOICE ANALYSIS</p>
      <h1>{brand.name}</h1>
      <p className={styles.description}>{brand.description}</p>
      <section aria-label="분석 모델 상태" className={styles.status}>
        <span aria-hidden="true" className={styles.dot} />
        <div>
          <strong>분석 모델 준비 전</strong>
          <p>{brand.privacyPromise}</p>
        </div>
      </section>
      <button type="button">분석 모델 받기</button>
      <p className={styles.note}>확률이나 진단이 아닌, 녹음된 목소리의 음향적 경향을 보여줍니다.</p>
      <Recorder />
      <Link className={styles.privacy} href="/privacy/">개인정보처리방침</Link>
    </main>
  );
}
