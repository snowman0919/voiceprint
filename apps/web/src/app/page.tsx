import styles from "./page.module.css";
import { Recorder } from "@/features/recording/recorder";

export default function Home() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>ON-DEVICE VOICE ANALYSIS</p>
      <h1>Voiceprint</h1>
      <p className={styles.description}>
        목소리의 높이, 공명, 음색과 인상 경향을 이 기기에서 분석합니다.
      </p>
      <section aria-label="분석 모델 상태" className={styles.status}>
        <span aria-hidden="true" className={styles.dot} />
        <div>
          <strong>분석 모델 준비 전</strong>
          <p>음성은 이 기기를 벗어나지 않습니다.</p>
        </div>
      </section>
      <button type="button">분석 모델 받기</button>
      <p className={styles.note}>확률이나 진단이 아닌, 녹음된 목소리의 음향적 경향을 보여줍니다.</p>
      <Recorder />
    </main>
  );
}
