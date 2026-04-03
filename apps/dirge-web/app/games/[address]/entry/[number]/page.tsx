// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { fetchGame, fetchGameEntries, gameStatusLabel, entryStatusLabel, formatAmount, shortAddress } from "@/lib/program";

export default function EntryPage() {
  const params = useParams();
  const address = params.address as string;
  const entryNum = parseInt(params.number as string);

  const { connection } = useConnection();
  const wallet = useWallet();

  const [game, setGame] = useState(null);
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !entryNum) return;
    loadData();
  }, [address, entryNum, connection]);

  async function loadData() {
    setLoading(true);
    try {
      const [g, entries] = await Promise.all([
        fetchGame(connection, wallet, address),
        fetchGameEntries(connection, wallet, address),
      ]);
      setGame(g);
      const found = entries.find((e) => e.account.entryNumber === entryNum);
      setEntry(found || null);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        Loading entry...
      </div>
    );
  }

  const status = entry ? entryStatusLabel(entry.account.status) : null;
  const gameStatus = game ? gameStatusLabel(game.status) : null;
  const isAlive = status === "ALIVE";
  const isWinner = game && gameStatus === "ENDED" && isAlive;

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/games/${address}`}>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>← Back to Game</span>
        </Link>
      </div>

      <div
        className="rounded-2xl p-8 border text-center"
        style={{
          background: "var(--surface)",
          borderColor: isWinner ? "rgba(250,204,21,0.3)" : isAlive ? "rgba(52,211,153,0.2)" : "rgba(220,38,38,0.2)",
        }}
      >
        {isWinner && <div className="text-6xl mb-4">🏆</div>}
        {!isWinner && isAlive && <div className="text-6xl mb-4">⚔️</div>}
        {!isAlive && status && <div className="text-6xl mb-4">💀</div>}
        {!entry && <div className="text-6xl mb-4">❓</div>}

        <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
          Entry #{entryNum}
        </h1>

        {game && (
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            in <span className="font-bold" style={{ color: "var(--text)" }}>{game.name}</span>
          </p>
        )}

        {entry ? (
          <>
            <div
              className="inline-block px-4 py-2 rounded-full text-sm font-bold mb-4"
              style={{
                background: isWinner
                  ? "rgba(250,204,21,0.15)"
                  : isAlive
                  ? "rgba(52,211,153,0.1)"
                  : "rgba(220,38,38,0.1)",
                color: isWinner ? "#fbbf24" : isAlive ? "#34d399" : "#f87171",
              }}
            >
              {isWinner ? "🏆 WINNER" : isAlive ? "✅ ALIVE" : "💀 ELIMINATED"}
            </div>

            <div className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              <p>Wallet: <span className="font-mono">{shortAddress(entry.account.player.toBase58())}</span></p>
              <p>Entered: {new Date(entry.account.enteredAt.toNumber() * 1000).toLocaleString()}</p>
              {!isAlive && entry.account.eliminatedAt.toNumber() > 0 && (
                <p>Eliminated: {new Date(entry.account.eliminatedAt.toNumber() * 1000).toLocaleString()}</p>
              )}
            </div>

            {entry.account.deathMessage && (
              <div
                className="mt-4 p-4 rounded-xl border-l-4 text-left text-sm italic"
                style={{
                  borderColor: "var(--dirge-accent)",
                  background: "rgba(220,38,38,0.04)",
                  color: "var(--text-muted)",
                }}
              >
                "{entry.account.deathMessage}"
              </div>
            )}

            {isWinner && entry.account.prizeClaimed && (
              <div className="mt-4 text-emerald-400 text-sm font-bold">Prize claimed ✓</div>
            )}
          </>
        ) : (
          <p style={{ color: "var(--text-muted)" }}>
            Entry #{entryNum} not found in this game.
          </p>
        )}
      </div>
    </main>
  );
}
