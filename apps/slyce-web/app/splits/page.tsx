"use client";

import Link from "next/link";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState, useCallback } from "react";
import { fetchAllSplits, type OnChainSplit } from "@/lib/program";
import { SUPPORTED_TOKENS } from "@/lib/constants";

function mintSymbol(mint: string): string {
  const found = SUPPORTED_TOKENS.find((t) => t.mint === mint);
  return found?.symbol ?? mint.slice(0, 6) + "…";
}

export default function SplitsPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const [splits, setSplits] = useState<OnChainSplit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const load = useCallback(async () => {
    if (!anchorWallet) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchAllSplits(connection, anchorWallet);
      // sort newest first
      data.sort((a, b) => b.createdAt - a.createdAt);
      setSplits(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [connection, anchorWallet]);

  useEffect(() => {
    if (anchorWallet) load();
  }, [anchorWallet, load]);

  const displayed = filter === "mine"
    ? splits.filter(
        (s) =>
          s.creator === publicKey?.toBase58() ||
          s.recipients.some((r) => r.address === publicKey?.toBase58())
      )
    : splits;

  return (
    <main className="min-h-screen bg-[#080c14] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
        <Link href="/" className="text-xl font-bold tracking-tight">slyce</Link>
        <div className="flex items-center gap-4">
          <Link href="/create" className="text-sm text-white/60 hover:text-white transition">
            + New Split
          </Link>
          <WalletMultiButton className="!bg-purple-600 !rounded-lg !text-sm" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Splits</h1>
            <p className="text-white/50 mt-1">
              {loading ? "Loading from devnet…" : `${splits.length} split${splits.length !== 1 ? "s" : ""} on-chain`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading || !anchorWallet}
            className="text-sm text-white/40 hover:text-white transition disabled:opacity-30"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Filter tabs */}
        {connected && (
          <div className="flex gap-2">
            {(["all", "mine"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm transition ${
                  filter === f
                    ? "bg-purple-600 text-white"
                    : "bg-white/5 text-white/50 hover:text-white"
                }`}
              >
                {f === "all" ? "All splits" : "My splits"}
              </button>
            ))}
          </div>
        )}

        {/* Not connected */}
        {!connected && (
          <div className="text-center py-16 space-y-4">
            <p className="text-white/40">Connect your wallet to browse splits</p>
            <WalletMultiButton className="!bg-purple-600 !rounded-lg" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse h-24" />
            ))}
          </div>
        )}

        {/* Splits list */}
        {!loading && displayed.map((split) => {
          const deposited = Number(split.totalDeposited);
          const symbol = mintSymbol(split.mint);
          const isCreator = split.creator === publicKey?.toBase58();
          const isRecipient = split.recipients.some(
            (r) => r.address === publicKey?.toBase58()
          );

          return (
            <Link
              key={split.address}
              href={`/splits/${split.address}`}
              className="block bg-white/5 border border-white/10 hover:border-purple-500/40 rounded-2xl p-6 transition group"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-lg group-hover:text-purple-300 transition">
                      {split.name || "Unnamed Split"}
                    </h2>
                    {split.locked && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                        Locked
                      </span>
                    )}
                    {split.autoDistribute && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        Auto
                      </span>
                    )}
                    {isCreator && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                        Creator
                      </span>
                    )}
                    {isRecipient && (
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                        Recipient
                      </span>
                    )}
                  </div>
                  {split.description && (
                    <p className="text-sm text-white/40 truncate">{split.description}</p>
                  )}
                  <p className="text-xs text-white/30 font-mono">
                    {split.address.slice(0, 20)}…
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/40">{symbol}</p>
                  <p className="font-semibold text-lg">
                    {deposited.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/40">
                    {split.recipients.length} recipient{split.recipients.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Recipient preview */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {split.recipients.map((r, i) => (
                  <span
                    key={i}
                    className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/50"
                  >
                    {r.label || r.address.slice(0, 8) + "…"}{" "}
                    {split.distributionMode === "percentage" && (
                      <span className="text-purple-400">{r.share_value / 100}%</span>
                    )}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}

        {/* Empty state */}
        {!loading && connected && displayed.length === 0 && (
          <div className="text-center py-24 text-white/30 space-y-3">
            <p className="text-lg">
              {filter === "mine" ? "You have no splits yet" : "No splits on-chain yet"}
            </p>
            <Link
              href="/create"
              className="text-purple-400 hover:text-purple-300 text-sm inline-block"
            >
              Create the first one →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
