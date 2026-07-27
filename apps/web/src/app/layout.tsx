import type { Metadata } from "next";
import "./globals.css";
import { StaticCacheRegistration } from "@/features/device/static-cache-registration";
import { brand } from "@/lib/brand";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: `${brand.name} | 온디바이스 음성 분석`,
  description: brand.privacyPromise,
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  openGraph: {
    title: brand.name,
    description: brand.description,
    images: siteUrl ? [{ url: "/og.svg", width: 1200, height: 630, alt: `${brand.name} 온디바이스 음성 분석` }] : [],
  },
  twitter: siteUrl ? { card: "summary_large_image", images: ["/og.svg"] } : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <StaticCacheRegistration />
        {children}
      </body>
    </html>
  );
}
