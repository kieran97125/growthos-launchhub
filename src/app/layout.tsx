import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchHub",
  description:
    "Campaign 啟動與 Lead Capture OS，用於 Campaign forms、Wix embeds、Landing Pages、UTM 捕捉及 Source Snapshots。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-HK" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
