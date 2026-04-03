"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { fetchAllGames, OnChainGame } from "@/lib/program";
import { KNOWN_TOKENS, SUPER_ADMIN } from "@/lib/constants";
import { BASIS_POINTS_DENOM } from "@/lib/constants";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Accepting entries", color: "#22c55e", bg: "#22c55e15" },
  active:    { label: "Live — In Progress", color: "#f59e0b", bg: "#f59e0b15" },
  ended:     { label: "Ended",              color: "#6366f1", bg: "#6366f115" },
  cancelled: { label: "Cancelled",          color: "#6b7280", bg: "#6b728015" },
};

function formatPot(game: OnChainGame): string {
  const token = KNOWN_TOKENS.find(t => t.mint === game.mint);
  const decimals = token?.decimals ?? 6;
  const symbol = token?.symbol ?? "tokens";
  const amount = (Number(game.totalPot) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${amount} ${symbol}`;
}

function formatFee(game: OnChainGame): string {
  const token = KNOWN_TOKENS.find(t => t.mint === game.mint);
  const decimals = token?.decimals ?? 6;
  const symbol = token?.symbol ?? "tokens";
  const amount = (Number(game.entryFee) / Math.pow(10, decimals)).toFixed(2);
  return `${amount} ${symbol}`;
}

export default function HomePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [games, setGames] = useState<OnChainGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "ended">("all");

  const isSuperAdmin = wallet.publicKey?.toBase58() === SUPER_ADMIN;

  useEffect(() => {
    if (!wallet.connected) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAllGames(connection, wallet)
      .then(setGames)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet.connected, connection]);

  const filtered = filter === "all" ? games : games.filter(g => g.status === filter);

  return (
    <div className="min-h-screen" style={{ background: "#080c14" }}>
      {/* Hero */}
      <div className="border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">⚔️</span>
              <h1 className="text-4xl font-black text-white tracking-tight">Gauntlet</h1>
            </div>
            <p className="text-slate-400 text-lg max-w-lg">
              Battle royale prize pools on Solana. Pay to enter. Last ones standing split the pot.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap">
              {["Any SPL token", "1% protocol fee", "On-chain eliminations", "Live feed"].map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/10">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {!wallet.connected ? (
              <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px", fontSize: "14px", height: "40px" }} />
            ) : (
              <>
                {(isSuperAdmin || wallet.connected) && (
                  <Link
                    href="/admin/create"
                    className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#d97706" }}
                  >
                    + Create Game
                  </Link>
                )}
                {isSuperAdmin && (
                  <Link
                    href="/admin"
                    className="px-5 py-2.5 rounded-lg font-semibold text-sm border border-amber-600/40 text-amber-400 hover:border-amber-500 transition"
                  >
                    Super Admin
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Filter bar */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(["all", "pending", "active", "ended"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all border"
              style={{
                background: filter === f ? "#d97706" : "transparent",
                borderColor: filter === f ? "#d97706" : "#334155",
                color: filter === f ? "#fff" : "#94a3b8",
              }}
            >
              {f === "all" ? "All games" : STATUS_LABELS[f]?.label}
            </button>
          ))}
        </div>

        {!wallet.connected ? (
          <div className="text-center py-24 text-slate-500">
            <div className="text-5xl mb-4">⚔️</div>
            <p className="text-lg mb-6">Connect your wallet to view games</p>
            <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px", fontSize: "14px" }} />
          </div>
        ) : loading ? (
          <div className="text-center py-24 text-slate-500">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p>Loading games from chain...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-500">
            <div className="text-5xl mb-4">🏜️</div>
            <p className="text-lg mb-2">No games found</p>
            <p className="text-sm">
              {filter !== "all" ? (
                <button onClick={() => setFilter("all")} className="text-amber-400 hover:underline">Show all games</button>
              ) : "Be the first to create one."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(game => {
              const s = STATUS_LABELS[game.status] ?? STATUS_LABELS.pending;
              const alive = game.playerCount - game.eliminatedCount;
              const pct = game.playerCount > 0 ? Math.round((game.eliminatedCount / game.playerCount) * 100) : 0;
              return (
                <Link
                  key={game.address}
                  href={`/games/${game.address}`}
                  className="block p-5 rounded-2xl border hover:border-amber-600/50 transition-all group"
                  style={{ background: "#0e1420", borderColor: "#1e293b" }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white text-lg leading-tight group-hover:text-amber-400 transition-colors">
                        {game.name}
                      </h3>
                      {game.theme && (
                        <p className="text-xs text-slate-500 mt-0.5">{game.theme}</p>
                      )}
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-2"
                      style={{ color: s.color, background: s.bg }}
                    >
                      {s.label}
                    </span>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Prize pool", value: formatPot(game) },
                      { label: "Entry fee", value: formatFee(game) },
                      { label: "Players", value: `${game.playerCount}/${game.maxPlayers}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-2 rounded-lg" style={{ background: "#080c14" }}>
                        <div className="text-xs text-slate-500">{label}</div>
                        <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Winners */}
                  <div className="text-xs text-slate-500 mb-3">
                    🏆 {game.winnerSplits.length} winner{game.winnerSplits.length !== 1 ? "s" : ""} —{" "}
                    {game.winnerSplits.map((bps, i) => `#${i+1}: ${(bps/100).toFixed(0)}%`).join(", ")}
                  </div>

                  {/* Progress bar for active/ended games */}
                  {(game.status === "active" || game.status === "ended") && game.playerCount > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>💀 {game.eliminatedCount} eliminated</span>
                        <span>⚔️ {alive} alive</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1e293b" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: "#ef4444" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {!game.mutable && (
                      <span className="text-xs px-2 py-0.5 rounded border border-slate-700 text-slate-500">🔒 immutable</span>
                    )}
                    {game.autoPay && (
                      <span className="text-xs px-2 py-0.5 rounded border border-emerald-800 text-emerald-500">⚡ auto-pay</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
