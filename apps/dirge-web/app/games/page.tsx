// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { fetchAllGames, gameStatusLabel, formatAmount } from "@/lib/program";

const TABS = ["All", "Open", "Live", "Ended"];

export default function GamesPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");

  useEffect(() => {
    loadGames();
  }, [connection]);

  async function loadGames() {
    setLoading(true);
    try {
      const all = await fetchAllGames(connection, wallet);
      setGames(all);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const filtered = games.filter((g) => {
    if (tab === "All") return true;
    const s = gameStatusLabel(g.account.status);
    if (tab === "Open") return s === "OPEN";
    if (tab === "Live") return s === "LIVE";
    if (tab === "Ended") return s === "ENDED" || s === "CLOSED";
    return true;
  });

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--text)" }}>⚔️ All Games</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {games.length} game{games.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/">
          <button className="text-sm" style={{ color: "var(--text-muted)" }}>← Home</button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition"
            style={{
              background: tab === t ? "var(--dirge-accent)" : "var(--surface)",
              color: tab === t ? "white" : "var(--text-muted)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
          Loading games...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
          <div className="text-4xl mb-3">💀</div>
          No {tab !== "All" ? tab.toLowerCase() : ""} games found.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((g) => {
          const status = gameStatusLabel(g.account.status);
          const isLive = status === "LIVE";
          const isEnded = status === "ENDED" || status === "CLOSED";
          const topPrize =
            g.account.winners.length > 0
              ? (g.account.totalPot.toNumber() * g.account.winners[0].basisPoints) / 10000
              : 0;

          const statusColor = isLive ? "#f87171" : isEnded ? "#6b7280" : "#34d399";
          const statusBg = isLive
            ? "rgba(220,38,38,0.1)"
            : isEnded
            ? "rgba(107,114,128,0.1)"
            : "rgba(52,211,153,0.1)";

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
                  <div className="flex-1 min-w-0 mr-3">
                    <h3 className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>
                      {g.account.name || "Unnamed"}
                    </h3>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {g.account.theme}
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded whitespace-nowrap"
                    style={{ background: statusBg, color: statusColor }}
                  >
                    {isLive && "🔴 "}{status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Pot</p>
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
                    <p style={{ color: "var(--text-muted)" }}>Entry</p>
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
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
