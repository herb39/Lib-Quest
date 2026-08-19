import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lib Quest",
  description: "도서관 서가를 탐험하며 책을 발견하는 퀘스트 서비스",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
