import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { WalletProviderWrapper } from "@/components/WalletProvider";
import { FamilyBar } from "@/components/FamilyBar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Slyce — Trustless Split Payments on Solana",
  description: "Create permissionless split payment streams. Anyone deposits, everyone gets their cut — automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>
        <WalletProviderWrapper>
          <FamilyBar />
          {children}
        </WalletProviderWrapper>
      </body>
    </html>
  );
}
