"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { fetchAllAirdrops, OnChainAirdrop } from "@/lib/program";
import { SUPPORTED_TOKENS } from "@/lib/constants";

type FilterType = "all" | "mine" | "claimable";

function getTokenSymbol(mint: string): string {
  const t = SUPPORTED_TOKENS.find((t) => t.mint === mint);
  return t?.symbol ?? mint.slice(0, 4) + "...";
}

function getTokenDecimals(mint: string): number {
  const t = SUPPORTED_TOKENS.find((t) => t.mint === mint);
  return t?.decimals ?? 6;
}

function formatTokenAmount(raw: string, mint: string): string {
  const decimals = getTokenDecimals(mint);
  const num = parseFloat(raw) / 10 ** decimals;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(2);
}

function StatusBadge({ status }: { status: OnChainAirdrop["status"] }) {
  const map = {
    pending: { bg: "#fbbf2420", border: "#fbbf2440", color: "#fbbf24", label: "Pending" },
    active: { bg: "#22c55e20", border: "#22c55e40", color: "#22c55e", label: "Active" },
    complete: { bg: "#0ea5e920", border: "#0ea5e940", color: "#0ea5e9", label: "Complete" },
    drained: { bg: "#6b728020", border: "#6b728040", color: "#6b7280", label: "Drained" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium border"
      style={{ background: s.bg, borderColor: s.border, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function ModeBadge({ mode }: { mode: OnChainAirdrop["mode"] }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium border"
      style={{
        background: mode === "push" ? "#0ea5e910" : "#8b5cf610",
        borderColor: mode === "push" ? "#0ea5e940" : "#8b5cf640",
        color: mode === "push" ? "#0ea5e9" : "#8b5cf6",
      }}
    >
      {mode === "push" ? "⚡ Push" : "✋ Claim"}
    </span>
  );
}

export default function DropsPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [airdrops, setAirdrops] = useState<OnChainAirdrop[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Use a dummy wallet for read-only
        const dummyWallet = {
          publicKey: null,
          signTransaction: async (tx: unknown) => tx,
          signAllTransactions: async (txs: unknown[]) => txs,
        };
        const data = await fetchAllAirdrops(connection, dummyWallet);
        setAirdrops(data.sort((a, b) => b.createdAt - a.createdAt));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [connection]);

  const filtered = airdrops.filter((a) => {
    if (filter === "mine") return wallet.publicKey && a.creator === wallet.publicKey.toBase58();
    if (filter === "claimable") {
      return (
        wallet.publicKey &&
        a.mode === "claim" &&
        a.status === "active" &&
        a.recipients.some(
          (r) => r.wallet === wallet.publicKey?.toBase58() && !r.claimed
        )
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: "#080c10" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: "#0ea5e9" }}>Drop</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#0ea5e9" }}
          >
            + Create
          </Link>
          <WalletMultiButton style={{
            background: "transparent", color: "#94a3b8", borderRadius: "8px",
            fontSize: "14px", height: "36px", padding: "0 16px",
            border: "1px solid #334155",
          }} />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Airdrops</h1>
            <p className="text-slate-400 text-sm mt-1">{airdrops.length} airdrop{airdrops.length !== 1 ? "s" : ""} on-chain</p>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "#0d1117" }}>
            {(["all", "mine", "claimable"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-1.5 rounded text-sm font-medium transition-all capitalize"
                style={{
                  background: filter === f ? "#1e293b" : "transparent",
                  color: filter === f ? "#e2e8f0" : "#64748b",
                }}
              >
                {f === "claimable" ? "Claimable" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-slate-500 flex items-center gap-3">
              <span className="animate-spin text-xl">⏳</span>
              Loading airdrops from devnet...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">📭</div>
            <div className="text-slate-400 mb-6">
              {filter === "mine"
                ? "You haven't created any airdrops yet."
                : filter === "claimable"
                ? "No claimable airdrops for your wallet."
                : "No airdrops found on devnet."}
            </div>
            <Link
              href="/create"
              className="px-6 py-2.5 rounded-lg font-semibold text-white"
              style={{ background: "#0ea5e9" }}
            >
              Create your first airdrop →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((airdrop) => {
              const claimed = airdrop.recipients.filter((r) => r.claimed).length;
              const total = airdrop.recipients.length;
              const progress = total > 0 ? (claimed / total) * 100 : 0;
              const isMine = wallet.publicKey && airdrop.creator === wallet.publicKey.toBase58();
              const canClaim =
                wallet.publicKey &&
                airdrop.mode === "claim" &&
                airdrop.status === "active" &&
                airdrop.recipients.some(
                  (r) => r.wallet === wallet.publicKey?.toBase58() && !r.claimed
                );

              return (
                <Link
                  key={airdrop.address}
                  href={`/drops/${airdrop.address}`}
                  className="block p-5 rounded-xl border transition-all hover:border-sky-500/40"
                  style={{ background: "#0d1117", borderColor: "#1e293b" }}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-white font-semibold truncate">{airdrop.name || "Unnamed airdrop"}</h3>
                        {isMine && (
                          <span className="text-xs px-2 py-0.5 rounded-full border"
                            style={{ background: "#0ea5e910", borderColor: "#0ea5e940", color: "#0ea5e9" }}>
                            yours
                          </span>
                        )}
                        {canClaim && (
                          <span className="text-xs px-2 py-0.5 rounded-full border animate-pulse"
                            style={{ background: "#22c55e10", borderColor: "#22c55e40", color: "#22c55e" }}>
                            claim available
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={airdrop.status} />
                        <ModeBadge mode={airdrop.mode} />
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-white">
                        {formatTokenAmount(airdrop.totalTokens, airdrop.mint)} {getTokenSymbol(airdrop.mint)}
                      </div>
                      <div className="text-xs text-slate-500">{total} recipients</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>{claimed}/{total} {airdrop.mode === "claim" ? "claimed" : "paid"}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1e293b" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, background: progress === 100 ? "#22c55e" : "#0ea5e9" }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-600 font-mono">
                    {airdrop.address.slice(0, 8)}...{airdrop.address.slice(-6)}
                    {" · "}
                    {new Date(airdrop.createdAt * 1000).toLocaleDateString()}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
