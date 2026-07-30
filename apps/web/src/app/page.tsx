"use client";

import styles from "./page.module.css";
import Link from "next/link";
import { useCallback, useState } from "react";
import { brand } from "@/lib/brand";
import { ModelStatus } from "@/features/model/model-status";

export default function Home() {
  const [modelReady, setModelReady] = useState(false);
  const handleModelStatus = useCallback((status: "loading" | "unavailable" | "ready" | "downloading" | "error") => {
    setModelReady(status === "ready");
  }, []);

  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>ON-DEVICE VOICE ANALYSIS</p>
      <h1>{brand.name}</h1>
      <p className={styles.description}>{brand.description}</p>
      <ModelStatus onStatusChange={handleModelStatus} />
      <p className={styles.note}>확률이나 진단이 아닌, 녹음된 목소리의 음향적 경향을 보여줍니다.</p>
      {modelReady ? (
        <Link className={styles.start} href="/analyze/">
          분석 시작하기
        </Link>
      ) : (
        <button className={styles.start} disabled type="button">
          모델 준비 후 시작할 수 있어요
        </button>
      )}
      <Link className={styles.privacy} href="/privacy/">
        개인정보처리방침
      </Link>
    </main>
  );
}
