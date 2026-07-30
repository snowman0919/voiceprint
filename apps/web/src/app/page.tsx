"use client";

import styles from "./page.module.css";
import Link from "next/link";
import { brand } from "@/lib/brand";

export default function Home() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>ON-DEVICE VOICE ANALYSIS</p>
      <h1>{brand.name}</h1>
      <p className={styles.description}>{brand.description}</p>
      <Link className={styles.start} href="/analyze/">
        분석 시작하기
      </Link>
      <Link className={styles.privacy} href="/privacy/">
        개인정보처리방침
      </Link>
    </main>
  );
}
