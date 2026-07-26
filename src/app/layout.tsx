import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kairvo LaunchHub | Campaign Launch & Lead Capture",
    template: "%s | Kairvo LaunchHub",
  },
  description:
    "Kairvo LaunchHub creates campaign forms, embeds and landing pages with UTM capture, attribution evidence and source snapshots. Product by SmartVolt.",
  applicationName: "Kairvo LaunchHub",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-HK" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
