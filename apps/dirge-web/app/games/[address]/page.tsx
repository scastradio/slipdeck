// @ts-nocheck
"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  fetchGame,
  fetchGameEntries,
  enterGame,
  claimPrize,
  gameStatusLabel,
  entryStatusLabel,
  formatAmount,
  shortAddress,
  getEntryPDA,
} from "@/lib/program";
import { PublicKey } from "@solana/web3.js";

export default function GameDetailPage() {
  const params = useParams();
  const address = params.address as string;
  const { connection } = useConnection();
  const wallet = useWallet();

  const [game, setGame] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const feedRef = useRef(null);

  useEffect(() => {
    if (!address) return;
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [address, connection]);

  async function loadData() {
    try {
      const [g, e] = await Promise.all([
        fetchGame(connection, wallet, address),
        fetchGameEntries(connection, wallet, address),
      ]);
      setGame(g);
      setEntries(e.sort((a, b) => a.account.entryNumber - b.account.entryNumber));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleEnter() {
    if (!wallet.connected || !wallet.publicKey) return;
    setError(""); setSuccess(""); setTxPending(true);
    try {
      const superConfigPDA = PublicKey.findProgramAddressSync(
        [Buffer.from("dirge_config")],
        new PublicKey("CAeLQYB1PFQGDq3iWAscG7rjPQJyRyjEMkxjwhuGbgKL")
      )[0];
      // Fetch super config to get treasury
      const { fetchSuperConfig } = await import("@/lib/superconfig");
      const cfg = await fetchSuperConfig(connection, wallet);
      await enterGame(
        connection, wallet, wallet.publicKey, address,
        game.entryMint.toBase58(), cfg.treasury.toBase58()
      );
      setSuccess("Entered! You're in the game. ⚔️");
      await loadData();
    } catch (e) {
      setError(e.message || "Transaction failed");
    }
    setTxPending(false);
  }

  async function handleClaim(winnerPlace: number) {
    if (!wallet.connected || !wallet.publicKey) return;
    setError(""); setSuccess(""); setTxPending(true);
    try {
      await claimPrize(connection, wallet, wallet.publicKey, address, game.entryMint.toBase58(), winnerPlace);
      setSuccess("Prize claimed! 🏆");
      await loadData();
    } catch (e) {
      setError(e.message || "Transaction failed");
    }
    setTxPending(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        Loading game...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        Game not found.
        <Link href="/games" className="ml-4 underline">← All Games</Link>
      </div>
    );
  }

  const status = gameStatusLabel(game.status);
  const isOpen = status === "OPEN";
  const isLive = status === "LIVE";
  const isEnded = status === "ENDED" || status === "CLOSED";

  const aliveEntries = entries.filter((e) => entryStatusLabel(e.account.status) === "ALIVE");
  const eliminatedEntries = entries.filter((e) => entryStatusLabel(e.account.status) === "ELIMINATED")
    .sort((a, b) => b.account.eliminatedAt.toNumber() - a.account.eliminatedAt.toNumber());

  const myEntry = wallet.publicKey
    ? entries.find((e) => e.account.player.toBase58() === wallet.publicKey.toBase58())
    : null;

  const myStatus = myEntry ? entryStatusLabel(myEntry.account.status) : null;
  const myAliveRank = myStatus === "ALIVE"
    ? aliveEntries.findIndex((e) => e.account.player.toBase58() === wallet.publicKey?.toBase58())
    : -1;

  const nextInterval = game.lastEliminationAt.toNumber() + game.eliminationIntervalSeconds.toNumber();
  const now = Math.floor(Date.now() / 1000);
  const secondsUntilNext = Math.max(0, nextInterval - now);

  return (
    <main className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/games">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>← Games</span>
        </Link>
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{
            background: isLive ? "rgba(220,38,38,0.2)" : isEnded ? "rgba(107,114,128,0.2)" : "rgba(52,211,153,0.15)",
            color: isLive ? "#f87171" : isEnded ? "#9ca3af" : "#34d399",
          }}
        >
          {isLive && "🔴 "}{status}
        </span>
      </div>

      {/* Game Header */}
      <div
        className="rounded-2xl p-6 border mb-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h1 className="text-3xl font-black mb-1" style={{ color: "var(--text)" }}>
          {game.name}
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          ⚔️ {game.theme}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="rounded-lg p-3" style={{ background: "var(--surface-hover)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Prize Pool</p>
            <p className="font-bold text-lg" style={{ color: "#f87171" }}>
              {formatAmount(game.totalPot)}
            </p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--surface-hover)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Survivors</p>
            <p className="font-bold text-lg" style={{ color: "var(--text)" }}>
              {game.aliveCount} / {game.playerCount}
            </p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--surface-hover)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Entry Fee</p>
            <p className="font-bold text-lg" style={{ color: "var(--text)" }}>
              {formatAmount(game.entryFee)}
            </p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--surface-hover)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Eliminations</p>
            <p className="font-bold text-lg" style={{ color: "var(--text)" }}>
              {game.eliminationCount}
            </p>
          </div>
        </div>

        {isLive && (
          <div className="mt-4 p-3 rounded-lg border border-red-900/40" style={{ background: "rgba(220,38,38,0.05)" }}>
            <p className="text-xs font-bold text-red-400">
              ⏱ Next elimination in: {secondsUntilNext > 0 ? `${Math.floor(secondsUntilNext / 60)}m ${secondsUntilNext % 60}s` : "ANY MOMENT..."}
            </p>
          </div>
        )}
      </div>

      {/* My Status */}
      {myEntry && (
        <div
          className="rounded-xl p-4 border mb-6"
          style={{
            background: myStatus === "ALIVE" ? "rgba(52,211,153,0.05)" : "rgba(220,38,38,0.05)",
            borderColor: myStatus === "ALIVE" ? "rgba(52,211,153,0.2)" : "rgba(220,38,38,0.2)",
          }}
        >
          <p className="text-sm font-bold mb-1" style={{ color: myStatus === "ALIVE" ? "#34d399" : "#f87171" }}>
            {myStatus === "ALIVE" ? "✅ You're still in it!" : "💀 You've been eliminated"}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Entry #{myEntry.account.entryNumber}
            {myStatus === "ALIVE" && myAliveRank >= 0 && ` · Alive rank: #${myAliveRank + 1}`}
          </p>
          {myEntry.account.deathMessage && (
            <p className="text-xs mt-2 italic" style={{ color: "var(--text-muted)" }}>
              "{myEntry.account.deathMessage}"
            </p>
          )}
          {isEnded && myStatus === "ALIVE" && game.payoutMode?.claim !== undefined && !myEntry.account.prizeClaimed && (
            <button
              onClick={() => handleClaim(myAliveRank)}
              disabled={txPending}
              className="mt-3 px-4 py-2 rounded-lg text-sm font-bold transition"
              style={{ background: "var(--dirge-accent)", color: "white" }}
            >
              {txPending ? "Processing..." : "🏆 Claim Prize"}
            </button>
          )}
          {myEntry.account.prizeClaimed && (
            <p className="text-xs mt-2 text-emerald-400">Prize claimed ✓</p>
          )}
        </div>
      )}

      {/* Enter Button */}
      {isOpen && !myEntry && (
        <div className="mb-6">
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          {success && <p className="text-emerald-400 text-sm mb-2">{success}</p>}
          {wallet.connected ? (
            <button
              onClick={handleEnter}
              disabled={txPending}
              className="w-full py-4 rounded-xl font-black text-lg transition"
              style={{ background: "var(--dirge-accent)", color: "white" }}
            >
              {txPending ? "Entering..." : `⚔️ Enter Game — ${formatAmount(game.entryFee)}`}
            </button>
          ) : (
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>
          )}
        </div>
      )}

      {/* Prize Breakdown */}
      <div
        className="rounded-xl p-4 border mb-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>
          🏆 Prize Breakdown
        </h2>
        {game.winners.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No prizes defined</p>
        ) : (
          <div className="space-y-2">
            {game.winners.map((w, i) => {
              const prize = (game.totalPot.toNumber() * w.basisPoints) / 10000;
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--text-muted)" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`} Place
                  </span>
                  <span style={{ color: "var(--text)" }}>
                    {(w.basisPoints / 100).toFixed(1)}% = {formatAmount(prize)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Elimination Feed */}
        {(isLive || isEnded) && eliminatedEntries.length > 0 && (
          <div
            className="rounded-xl p-4 border"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "var(--text)" }}>
              💀 Elimination Feed
              {isLive && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: "rgba(220,38,38,0.15)", color: "#f87171" }}
                >
                  LIVE
                </span>
              )}
            </h2>
            <div ref={feedRef} className="space-y-2 max-h-80 overflow-y-auto">
              {eliminatedEntries.map((e) => (
                <div
                  key={e.publicKey.toBase58()}
                  className="p-3 rounded-lg border-l-2 text-xs"
                  style={{
                    background: "rgba(220,38,38,0.04)",
                    borderColor: "var(--dirge-accent)",
                    color: "var(--text-muted)",
                  }}
                >
                  {e.account.deathMessage || `Entry #${e.account.entryNumber} was eliminated.`}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player List */}
        <div
          className="rounded-xl p-4 border"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>
            {isEnded ? "🏆 Survivors" : "👥 Players"} ({entries.length})
          </h2>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {(isEnded ? aliveEntries : entries).map((e) => {
              const eStatus = entryStatusLabel(e.account.status);
              return (
                <div
                  key={e.publicKey.toBase58()}
                  className="flex items-center justify-between py-1.5 px-2 rounded text-xs"
                  style={{
                    background: eStatus === "ALIVE" ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>
                    #{e.account.entryNumber} {shortAddress(e.account.player.toBase58())}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: eStatus === "ALIVE" ? "#34d399" : "#6b7280" }}
                  >
                    {eStatus === "ALIVE" ? "alive" : "💀"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Game: {shortAddress(address)} · Creator: {shortAddress(game.creator?.toBase58())}
      </div>
    </main>
  );
}
