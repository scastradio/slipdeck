// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { fetchAllGames, gameStatusLabel, formatAmount, shortAddress } from "@/lib/program";

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGames();
    const interval = setInterval(loadGames, 15000);
    return () => clearInterval(interval);
  }, [connection]);

  async function loadGames() {
    setLoading(true);
    try {
      const all = await fetchAllGames(connection, wallet);
      const active = all.filter((g) => {
        const status = gameStatusLabel(g.account.status);
        return status === "OPEN" || status === "LIVE";
      });
      setGames(active);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-5xl font-black tracking-tight mb-3" style={{ color: "var(--text)" }}>
            dirge
          </h1>
          <p className="text-xl mb-2" style={{ color: "var(--text-muted)" }}>
            everyone dies. someone wins.
          </p>
          <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
            On-chain last-one-standing elimination games on Solana
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/games">
              <button
                className="px-6 py-3 rounded-lg font-bold text-sm transition"
                style={{ background: "var(--dirge-accent)", color: "white" }}
              >
                Browse Games
              </button>
            </Link>
            <Link href="/admin">
              <button
                className="px-6 py-3 rounded-lg font-bold text-sm transition border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Create Game (Admin)
              </button>
            </Link>
            <div>
              <WalletMultiButton style={{ height: "46px", borderRadius: "8px", fontSize: "14px" }} />
            </div>
          </div>
        </div>
      </section>

      {/* Live Games */}
      <section className="px-6 pb-20 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Active Games
          </h2>
          {loading && (
            <span className="text-xs animate-pulse" style={{ color: "var(--text-muted)" }}>
              refreshing...
            </span>
          )}
        </div>

        {games.length === 0 && !loading && (
          <div
            className="text-center py-16 rounded-xl border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <div className="text-4xl mb-3">💀</div>
            <p>No active games right now.</p>
            <p className="text-sm mt-1">Check back soon — or create one.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => {
            const status = gameStatusLabel(g.account.status);
            const isLive = status === "LIVE";
            const topPrize =
              g.account.winners.length > 0
                ? (g.account.totalPot.toNumber() * g.account.winners[0].basisPoints) / 10000
                : 0;

            return (
              <Link key={g.publicKey.toBase58()} href={`/games/${g.publicKey.toBase58()}`}>
                <div
                  className="rounded-xl p-5 border cursor-pointer transition hover:border-red-800"
                  style={{
                    background: "var(--surface)",
                    borderColor: isLive ? "rgba(220,38,38,0.4)" : "var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>
                        {g.account.name || "Unnamed Game"}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {g.account.theme || "No theme"}
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded"
                      style={{
                        background: isLive ? "rgba(220,38,38,0.15)" : "rgba(255,255,255,0.05)",
                        color: isLive ? "#f87171" : "var(--text-muted)",
                      }}
                    >
                      {isLive && "🔴 "}{status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Prize Pool</p>
                      <p className="font-bold" style={{ color: "var(--text)" }}>
                        {formatAmount(g.account.totalPot)}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Players</p>
                      <p className="font-bold" style={{ color: "var(--text)" }}>
                        {g.account.aliveCount} / {g.account.playerCount}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Entry Fee</p>
                      <p className="font-bold" style={{ color: "var(--text)" }}>
                        {formatAmount(g.account.entryFee)}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Top Prize</p>
                      <p className="font-bold" style={{ color: "#f87171" }}>
                        {formatAmount(topPrize)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <button
                      className="w-full py-1.5 rounded text-xs font-bold transition"
                      style={{
                        background: isLive
                          ? "rgba(220,38,38,0.1)"
                          : "rgba(220,38,38,0.15)",
                        color: "#f87171",
                      }}
                    >
                      {isLive ? "Watch →" : "Enter →"}
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
