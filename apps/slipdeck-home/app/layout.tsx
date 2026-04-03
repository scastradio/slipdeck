import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "slipdeck — protocol UI",
  description: "The UI layer for slyce, ante and drop — trustless payment infrastructure on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
