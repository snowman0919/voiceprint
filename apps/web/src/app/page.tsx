import styles from "./page.module.css";
import { Recorder } from "@/features/recording/recorder";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { ModelStatus } from "@/features/model/model-status";

export default function Home() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>ON-DEVICE VOICE ANALYSIS</p>
      <h1>{brand.name}</h1>
      <p className={styles.description}>{brand.description}</p>
      <ModelStatus />
      <p className={styles.note}>확률이나 진단이 아닌, 녹음된 목소리의 음향적 경향을 보여줍니다.</p>
      <Recorder />
      <Link className={styles.privacy} href="/privacy/">개인정보처리방침</Link>
    </main>
  );
}
