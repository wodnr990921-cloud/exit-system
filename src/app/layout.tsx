import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "편지 관리 시스템",
  description: "OCR 편지 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
