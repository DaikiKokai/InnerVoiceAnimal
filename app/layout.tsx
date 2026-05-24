import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InnerVoice",
  description: "人には言えない心の声を、動物になって吐き出そう",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" style={{ height: "100%" }}>
      <body style={{ height: "100%" }}>{children}</body>
    </html>
  );
}
