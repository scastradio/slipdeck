// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { BN } from "@coral-xyz/anchor";
import {
  fetchAllGames,
  createGame,
  startGame,
  gameStatusLabel,
  formatAmount,
  shortAddress,
  getProgram,
} from "@/lib/program";
import { KNOWN_TOKENS } from "@/lib/constants";

const DEFAULT_WINNERS = [{ place: 1, basisPoints: 7000 }];

export default function AdminPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [myGames, setMyGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [entryFee, setEntryFee] = useState("1");
  const [selectedToken, setSelectedToken] = useState(KNOWN_TOKENS[0].mint);
  const [maxPlayers, setMaxPlayers] = useState("0");
  const [intervalSecs, setIntervalSecs] = useState("3600");
  const [intendedStart, setIntendedStart] = useState("");
  const [payoutMode, setPayoutMode] = useState("claim");
  const [mutability, setMutability] = useState("mutable");
  const [winners, setWinners] = useState(DEFAULT_WINNERS);

  useEffect(() => {
    if (wallet.connected && wallet.publicKey) loadMyGames();
  }, [wallet.connected, wallet.publicKey, connection]);

  async function loadMyGames() {
    setLoading(true);
    try {
      const all = await fetchAllGames(connection, wallet);
      const mine = all.filter(
        (g) => g.account.creator.toBase58() === wallet.publicKey.toBase58()
      );
      setMyGames(mine);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!wallet.connected || !wallet.publicKey) return;
    setError(""); setSuccess(""); setTxPending(true);

    try {
      const token = KNOWN_TOKENS.find((t) => t.mint === selectedToken) || KNOWN_TOKENS[0];
      const seed = new Uint8Array(8);
      crypto.getRandomValues(seed);
      const { PublicKey } = await import("@solana/web3.js");
      const mintPubkey = new PublicKey(selectedToken);
      const feeAmount = Math.round(parseFloat(entryFee) * Math.pow(10, token.decimals));
      const startTs = intendedStart ? Math.floor(new Date(intendedStart).getTime() / 1000) : Math.floor(Date.now() / 1000 + 3600);

      await createGame(connection, wallet, wallet.publicKey, {
        seed,
        name,
        theme,
        entryFee: new BN(feeAmount),
        entryMint: mintPubkey,
        maxPlayers: parseInt(maxPlayers),
        winners: winners.map((w) => ({ place: w.place, basisPoints: w.basisPoints })),
        mutability,
        payoutMode,
        intendedStart: new BN(startTs),
        eliminationIntervalSeconds: new BN(parseInt(intervalSecs)),
      });

      setSuccess("Game created! ⚔️");
      setName(""); setTheme("");
      await loadMyGames();
    } catch (err) {
      setError(err.message || "Transaction failed");
    }
    setTxPending(false);
  }

  async function handleStart(gameAddress: string) {
    if (!wallet.publicKey) return;
    setError(""); setSuccess(""); setTxPending(true);
    try {
      await startGame(connection, wallet, wallet.publicKey, gameAddress);
      setSuccess("Game started! ⚔️");
      await loadMyGames();
    } catch (err) {
      setError(err.message || "Failed to start game");
    }
    setTxPending(false);
  }

  function addWinner() {
    setWinners([...winners, { place: winners.length + 1, basisPoints: 2000 }]);
  }
  function removeWinner(i) {
    setWinners(winners.filter((_, idx) => idx !== i));
  }
  function updateWinner(i, field, val) {
    const w = [...winners];
    w[i] = { ...w[i], [field]: parseInt(val) || 0 };
    setWinners(w);
  }

  if (!wallet.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Admin Dashboard</h1>
        <p style={{ color: "var(--text-muted)" }}>Connect your wallet to manage games</p>
        <WalletMultiButton />
      </div>
    );
  }

  const totalBps = winners.reduce((s, w) => s + w.basisPoints, 0);

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--text)" }}>⚔️ Admin</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{shortAddress(wallet.publicKey.toBase58())}</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/admin/super">
            <button className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Super Admin →
            </button>
          </Link>
          <WalletMultiButton />
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 text-red-400 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-lg bg-emerald-900/20 text-emerald-400 text-sm">{success}</div>}

      {/* Create Game Form */}
      <div
        className="rounded-2xl p-6 border mb-8"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>Create New Game</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Game Name *</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="The Arena of Doom"
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Theme *</label>
              <input
                value={theme} onChange={(e) => setTheme(e.target.value)} required
                placeholder="e.g. Medieval tournament"
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Entry Fee</label>
              <input
                type="number" min="0" step="0.01"
                value={entryFee} onChange={(e) => setEntryFee(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Token</label>
              <select
                value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                {KNOWN_TOKENS.map((t) => (
                  <option key={t.mint} value={t.mint}>{t.symbol}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Max Players (0 = unlimited)</label>
              <input
                type="number" min="0"
                value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Elimination Interval (seconds)</label>
              <input
                type="number" min="1"
                value={intervalSecs} onChange={(e) => setIntervalSecs(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Intended Start</label>
              <input
                type="datetime-local"
                value={intendedStart} onChange={(e) => setIntendedStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Payout Mode</label>
              <select
                value={payoutMode} onChange={(e) => setPayoutMode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                <option value="claim">Claim (winners pull)</option>
                <option value="auto">Auto (push)</option>
              </select>
            </div>
          </div>

          {/* Winners */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Winners &amp; Prize Splits ({(totalBps / 100).toFixed(1)}% total — max 99%)
              </label>
              <button type="button" onClick={addWinner} className="text-xs text-red-400 hover:text-red-300">
                + Add Winner
              </button>
            </div>
            <div className="space-y-2">
              {winners.map((w, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <span className="text-sm w-6 text-center" style={{ color: "var(--text-muted)" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <input
                    type="number" min="0" max="9900" placeholder="bps (e.g. 5000 = 50%)"
                    value={w.basisPoints}
                    onChange={(e) => updateWinner(i, "basisPoints", e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm border"
                    style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                  <span className="text-xs w-12" style={{ color: "var(--text-muted)" }}>
                    {(w.basisPoints / 100).toFixed(1)}%
                  </span>
                  {winners.length > 1 && (
                    <button type="button" onClick={() => removeWinner(i)} className="text-red-500 text-xs">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={txPending || totalBps > 9900}
            className="w-full py-3 rounded-xl font-bold text-sm transition"
            style={{ background: "var(--dirge-accent)", color: "white", opacity: txPending ? 0.7 : 1 }}
          >
            {txPending ? "Creating..." : "⚔️ Create Game"}
          </button>
        </form>
      </div>

      {/* My Games */}
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>My Games</h2>
        {loading && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>}
        {!loading && myGames.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No games created yet.</p>
        )}
        <div className="space-y-3">
          {myGames.map((g) => {
            const status = gameStatusLabel(g.account.status);
            return (
              <div
                key={g.publicKey.toBase58()}
                className="rounded-xl p-4 border flex items-center justify-between"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{g.account.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {status} · {g.account.playerCount} players · Pot: {formatAmount(g.account.totalPot)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/games/${g.publicKey.toBase58()}`}>
                    <button className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      View
                    </button>
                  </Link>
                  {status === "OPEN" && g.account.playerCount >= 2 && (
                    <button
                      onClick={() => handleStart(g.publicKey.toBase58())}
                      disabled={txPending}
                      className="text-xs px-3 py-1.5 rounded font-bold"
                      style={{ background: "var(--dirge-accent)", color: "white" }}
                    >
                      Start Game
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
