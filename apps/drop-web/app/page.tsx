"use client";

import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "#080c10" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: "#0ea5e9" }}>Drop</span>
          <span className="text-xs px-2 py-0.5 rounded-full text-slate-400 border border-slate-700">devnet</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/drops" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
            Browse
          </Link>
          <WalletMultiButton style={{
            background: "#0ea5e9",
            color: "#fff",
            borderRadius: "8px",
            fontSize: "14px",
            height: "36px",
            padding: "0 16px",
          }} />
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-8 border"
            style={{ borderColor: "#0ea5e920", background: "#0ea5e910", color: "#0ea5e9" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse inline-block" />
            Live on Solana Devnet
          </div>

          <h1 className="text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Drop.{" "}
            <span style={{ color: "#0ea5e9" }}>Airdrop any token</span>
            <br />to any wallet list on Solana.
          </h1>

          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Upload a list. Set amounts. One click to fund. Done.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/create"
              className="px-8 py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: "#0ea5e9", boxShadow: "0 0 24px #0ea5e940" }}
            >
              Create airdrop →
            </Link>
            <Link
              href="/drops"
              className="px-8 py-3 rounded-lg font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 transition-colors"
            >
              Browse airdrops
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-500 mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Upload list",
                desc: "Paste wallet addresses or upload a CSV. Supports equal splits or custom amounts per wallet.",
                icon: "📋",
              },
              {
                step: "02",
                title: "Fund vault",
                desc: "Approve transactions to deposit tokens. Large lists auto-batch into groups of 50. 0.001 SOL protocol fee per recipient.",
                icon: "💸",
              },
              {
                step: "03",
                title: "Drop executes",
                desc: "Push mode: tokens sent automatically. Claim mode: recipients claim at their convenience.",
                icon: "🚀",
              },
            ].map(({ step, title, desc, icon }) => (
              <div
                key={step}
                className="relative p-6 rounded-xl border"
                style={{ background: "#0d1117", borderColor: "#1e293b" }}
              >
                <div className="text-xs font-mono text-slate-600 mb-3">{step}</div>
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border" style={{ background: "#0d1117", borderColor: "#1e293b" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ background: "#0ea5e920" }}>
                ⚡
              </div>
              <h3 className="text-white font-semibold">Push mode</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Fund once. The executor sends tokens to every wallet automatically.
              Great for guaranteed distributions.
            </p>
          </div>
          <div className="p-6 rounded-xl border" style={{ background: "#0d1117", borderColor: "#1e293b" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ background: "#0ea5e920" }}>
                ✋
              </div>
              <h3 className="text-white font-semibold">Claim mode</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Recipients claim their own allocation when ready.
              They pay ATA creation fees — reduces creator cost.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 p-8 rounded-xl border text-center"
          style={{ background: "#0d1117", borderColor: "#1e293b" }}>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <div className="text-3xl font-bold" style={{ color: "#0ea5e9" }}>∞</div>
              <div className="text-slate-500 text-sm mt-1">No wallet limit — auto-batched</div>
            </div>
            <div>
              <div className="text-3xl font-bold" style={{ color: "#0ea5e9" }}>0.001</div>
              <div className="text-slate-500 text-sm mt-1">SOL per recipient</div>
            </div>
            <div>
              <div className="text-3xl font-bold" style={{ color: "#0ea5e9" }}>Any</div>
              <div className="text-slate-500 text-sm mt-1">SPL token supported</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-slate-600 text-sm">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="font-bold" style={{ color: "#0ea5e9" }}>Drop</span>
            <span>— Airdrop any token on Solana</span>
          </div>
          <div className="text-xs">
            Program:{" "}
            <a
              href="https://explorer.solana.com/address/5RVHbWKCiiF14eTXV6MZGbQ4EvYC83vvDPKbjVd6C37w?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-slate-400 transition-colors"
              style={{ color: "#0ea5e9" }}
            >
              5RVHbWK...C37w
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
