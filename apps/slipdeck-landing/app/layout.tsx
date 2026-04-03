import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "slipdeck — on-chain protocol suite",
  description: "Split payments, group vaults, and token airdrops. Built on Solana.",
  openGraph: {
    title: "slipdeck",
    description: "Split payments, group vaults, and token airdrops on Solana.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
