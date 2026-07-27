import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voiceprint | 온디바이스 음성 분석",
  description: "음성은 이 기기를 벗어나지 않습니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
