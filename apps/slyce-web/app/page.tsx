"use client";

import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
  const { connected } = useWallet();

  return (
    <main className="min-h-screen bg-[#080c14] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight">slyce</span>
          <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">devnet</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/splits" className="text-sm text-white/60 hover:text-white transition">
            My Splits
          </Link>
          <WalletMultiButton className="!bg-purple-600 !rounded-lg !text-sm" />
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 gap-6">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/70">
          🔪 Trustless split payments on Solana
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-3xl leading-tight">
          Split payments.<br />
          <span className="text-purple-400">No middleman.</span>
        </h1>
        <p className="text-lg text-white/50 max-w-xl">
          Create a split, add up to 10 recipients, define their shares.
          Anyone deposits — everyone gets their cut automatically.
          Fully on-chain. 1% protocol fee. That's it.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Link
            href="/create"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition text-sm"
          >
            Create a Split →
          </Link>
          <Link
            href="/splits"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-6 py-3 rounded-xl transition text-sm"
          >
            Browse Splits
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          {
            icon: "🔧",
            title: "Create",
            desc: "Define recipients and their percentage shares. Choose auto-distribute or let recipients claim.",
          },
          {
            icon: "💸",
            title: "Deposit",
            desc: "Anyone sends tokens to your split. 1% protocol fee taken on deposit. The rest goes to the vault.",
          },
          {
            icon: "✅",
            title: "Receive",
            desc: "Recipients claim their share anytime, or it distributes automatically on each deposit.",
          },
        ].map((step) => (
          <div key={step.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <div className="text-3xl">{step.icon}</div>
            <h3 className="font-semibold text-lg">{step.title}</h3>
            <p className="text-sm text-white/50">{step.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
