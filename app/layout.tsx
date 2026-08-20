import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lecture Note | 講義音声を学習ノートに",
  description: "講義音声から文字起こし，3行要約，要点を作成する学習用Webアプリ．",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
