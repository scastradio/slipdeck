"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  fetchGame, fetchPlayersForGame, OnChainGame, OnChainPlayer,
  getProgram, getProtocolConfigPDA, getPlayerPDA, getVaultPDA,
} from "@/lib/program";
import { KNOWN_TOKENS, SUPER_ADMIN, BASIS_POINTS_DENOM } from "@/lib/constants";

const STATUS_LABELS: Record<string, string> = {
  pending: "Accepting entries",
  active: "Live ⚔️",
  ended: "Ended 🏆",
  cancelled: "Cancelled",
};

function formatAmount(raw: string, mint: string): string {
  const token = KNOWN_TOKENS.find(t => t.mint === mint);
  const decimals = token?.decimals ?? 6;
  const symbol = token?.symbol ?? "tokens";
  return `${(Number(raw) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

const FEED_ICONS: Record<string, string> = {
  gameStart: "⚔️",
  elimination: "💀",
  gameEnd: "🏆",
  payout: "💰",
  systemMessage: "📢",
};

export default function GamePage() {
  const params = useParams();
  const address = params.address as string;
  const { connection } = useConnection();
  const wallet = useWallet();

  const [game, setGame] = useState<OnChainGame | null>(null);
  const [players, setPlayers] = useState<OnChainPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [txError, setTxError] = useState("");
  const [txStep, setTxStep] = useState("");

  const load = useCallback(async () => {
    if (!wallet.connected) return;
    const [g, p] = await Promise.all([
      fetchGame(connection, wallet, address),
      fetchPlayersForGame(connection, wallet, address),
    ]);
    setGame(g);
    setPlayers(p);
    setLoading(false);
  }, [connection, wallet, address]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 10s for active games
  useEffect(() => {
    if (game?.status !== "active") return;
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [game?.status, load]);

  const myPlayer = players.find(p => p.player === wallet.publicKey?.toBase58());
  const isSuperAdmin = wallet.publicKey?.toBase58() === SUPER_ADMIN;
  const isAdmin = game && (wallet.publicKey?.toBase58() === game.admin || isSuperAdmin);
  const aliveCount = game ? game.playerCount - game.eliminatedCount : 0;

  const handleEnter = async () => {
    if (!wallet.publicKey || !game) return;
    setEntering(true);
    setTxError("");
    setTxStep("Preparing transaction...");

    try {
      const program = getProgram(connection, wallet);
      const [configPDA] = getProtocolConfigPDA();
      const config = await (program.account as any).protocolConfig.fetch(configPDA);

      const gameKey = new PublicKey(address);
      const mintKey = new PublicKey(game.mint);
      const [playerPDA] = getPlayerPDA(gameKey, wallet.publicKey);
      const [vaultPDA] = getVaultPDA(BigInt(game.gameId));
      const treasuryATA = await getAssociatedTokenAddress(mintKey, config.treasury);
      const playerATA = await getAssociatedTokenAddress(mintKey, wallet.publicKey);
      const nextEntryNumber = game.playerCount + 1;

      setTxStep("Awaiting wallet approval...");
      await (program.methods as any).enterGame(nextEntryNumber)
        .accounts({
          protocolConfig: configPDA,
          game: gameKey,
          playerAccount: playerPDA,
          vault: vaultPDA,
          playerTokenAccount: playerATA,
          treasuryTokenAccount: treasuryATA,
          mint: mintKey,
          player: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      setTxStep("✅ Entered! Good luck, fighter.");
      await load();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : String(e));
      setTxStep("");
    } finally {
      setEntering(false);
    }
  };

  const handleClaim = async () => {
    if (!wallet.publicKey || !game || !myPlayer) return;
    setClaiming(true);
    setTxError("");
    setTxStep("Claiming prize...");

    try {
      const program = getProgram(connection, wallet);
      const [configPDA] = getProtocolConfigPDA();
      const gameKey = new PublicKey(address);
      const mintKey = new PublicKey(game.mint);
      const [playerPDA] = getPlayerPDA(gameKey, wallet.publicKey);
      const [vaultPDA] = getVaultPDA(BigInt(game.gameId));
      const winnerATA = await getAssociatedTokenAddress(mintKey, wallet.publicKey);

      await (program.methods as any).claimPrize()
        .accounts({
          protocolConfig: configPDA,
          game: gameKey,
          playerAccount: playerPDA,
          vault: vaultPDA,
          winnerTokenAccount: winnerATA,
          winner: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setTxStep("🎉 Prize claimed!");
      await load();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : String(e));
      setTxStep("");
    } finally {
      setClaiming(false);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
        <div className="text-center">
          <div className="text-5xl mb-4">⚔️</div>
          <p className="text-slate-400 mb-6">Connect your wallet to view this game</p>
          <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px" }} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
        <div className="text-center text-slate-500">
          <div className="animate-spin text-4xl mb-3">⏳</div>
          <p>Loading from chain...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
        <div className="text-center">
          <div className="text-5xl mb-4">🏜️</div>
          <p className="text-slate-400 mb-4">Game not found</p>
          <Link href="/" className="text-amber-400 hover:underline">← Back to games</Link>
        </div>
      </div>
    );
  }

  const prizeForRank = (rank: number) => {
    if (rank > game.winnerSplits.length) return null;
    const bps = game.winnerSplits[rank - 1];
    const raw = (Number(game.totalPot) * bps / BASIS_POINTS_DENOM).toFixed(0);
    return formatAmount(raw, game.mint);
  };

  return (
    <div className="min-h-screen" style={{ background: "#080c14" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <Link href="/" className="text-slate-400 hover:text-white transition text-sm">← Games</Link>
        <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px", fontSize: "13px", height: "34px", padding: "0 14px" }} />
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: game info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start gap-4 mb-2">
              <div className="flex-1">
                <h1 className="text-3xl font-black text-white">{game.name}</h1>
                {game.theme && <p className="text-slate-400 text-sm mt-1">{game.theme}</p>}
              </div>
              <span className="text-sm px-3 py-1 rounded-full font-medium"
                style={{
                  color: game.status === "active" ? "#f59e0b" : game.status === "ended" ? "#818cf8" : game.status === "pending" ? "#22c55e" : "#6b7280",
                  background: game.status === "active" ? "#f59e0b15" : game.status === "ended" ? "#818cf815" : game.status === "pending" ? "#22c55e15" : "#6b728015"
                }}>
                {STATUS_LABELS[game.status]}
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: "Prize Pool", value: formatAmount(game.totalPot, game.mint) },
                { label: "Entry Fee", value: formatAmount(game.entryFee, game.mint) },
                { label: "Players", value: `${game.playerCount} / ${game.maxPlayers}` },
                { label: "Alive", value: game.status === "pending" ? "—" : `${aliveCount}` },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl border" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="text-base font-bold text-white mt-0.5">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Prize breakdown */}
          <div className="p-5 rounded-2xl border" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">🏆 Prize structure</h3>
            <div className="space-y-2">
              {game.winnerSplits.map((bps, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</span>
                    <span className="text-slate-300">Rank {i + 1}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-mono font-semibold">{(bps / 100).toFixed(0)}%</span>
                    {game.totalPot !== "0" && (
                      <span className="text-slate-500 text-xs ml-2">≈ {prizeForRank(i + 1)}</span>
                    )}
                  </div>
                </div>
              ))}
              {game.adminProfitBps > 0 && (
                <div className="flex justify-between text-sm border-t pt-2 mt-2" style={{ borderColor: "#1e293b" }}>
                  <span className="text-slate-500">Admin profit</span>
                  <span className="text-slate-400">{(game.adminProfitBps / 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Live Feed */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
              <h3 className="text-sm font-semibold text-slate-300">
                📜 Live Feed
                {game.status === "active" && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                  </span>
                )}
              </h3>
              <span className="text-xs text-slate-600">{game.feed.length} events</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {game.feed.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-sm">
                  No events yet. Game starts when admin fires the signal.
                </div>
              ) : (
                [...game.feed].reverse().map((event, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3 border-b last:border-0 text-sm"
                    style={{ borderColor: "#0f172a", background: event.kind === "elimination" ? "#1c0a0a" : "transparent" }}
                  >
                    <span className="text-lg shrink-0">{FEED_ICONS[event.kind] ?? "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300">{event.message}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{timeAgo(event.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Player list */}
          {players.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
              <div className="px-4 py-3 border-b" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
                <h3 className="text-sm font-semibold text-slate-300">⚔️ Fighters ({players.length})</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {players.map((p) => (
                  <div
                    key={p.address}
                    className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 text-sm"
                    style={{
                      borderColor: "#0f172a",
                      background: p.player === wallet.publicKey?.toBase58() ? "#d9770610" : "transparent"
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{p.alive ? "⚔️" : "💀"}</span>
                      <div>
                        <span className="font-mono text-slate-300 text-xs">
                          #{p.entryNumber} · {p.player.slice(0, 6)}…{p.player.slice(-4)}
                          {p.player === wallet.publicKey?.toBase58() && (
                            <span className="ml-1 text-amber-400 font-semibold">you</span>
                          )}
                        </span>
                        {!p.alive && p.deathMessage && (
                          <p className="text-xs text-red-400 italic">{p.deathMessage}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      {p.finalRank && (
                        <span className="text-amber-400 font-semibold">Rank #{p.finalRank}</span>
                      )}
                      {!p.alive && !p.finalRank && (
                        <span className="text-slate-600">eliminated</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: action panel */}
        <div className="space-y-4">
          {/* Entry widget */}
          {game.status === "pending" && !myPlayer && wallet.connected && (
            <div className="p-5 rounded-2xl border" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
              <h3 className="font-bold text-white mb-1">Enter the Gauntlet</h3>
              <p className="text-sm text-slate-400 mb-4">
                Pay the entry fee and fight for glory. Last standing wins.
              </p>
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Entry fee</span>
                  <span className="text-white font-mono">{formatAmount(game.entryFee, game.mint)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Protocol fee (1%)</span>
                  <span className="text-slate-400 font-mono">
                    {formatAmount(Math.floor(Number(game.entryFee) * 0.01).toString(), game.mint)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold" style={{ borderColor: "#1e293b" }}>
                  <span className="text-slate-300">Total to pay</span>
                  <span className="text-amber-400 font-mono">{formatAmount(game.entryFee, game.mint)}</span>
                </div>
              </div>
              {txError && <p className="text-red-400 text-xs mb-3">{txError}</p>}
              {txStep && <p className="text-sky-400 text-xs mb-3">{txStep}</p>}
              <button
                onClick={handleEnter}
                disabled={entering}
                className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50"
                style={{ background: "#d97706" }}
              >
                {entering ? "⏳ Entering..." : "⚔️ Enter Gauntlet"}
              </button>
            </div>
          )}

          {/* Already entered */}
          {myPlayer && (
            <div className="p-5 rounded-2xl border" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
              <h3 className="font-bold text-white mb-2">Your entry</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Entry #</span>
                  <span className="text-white font-mono">#{myPlayer.entryNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className={myPlayer.alive ? "text-emerald-400" : "text-red-400"}>
                    {myPlayer.alive ? "⚔️ Alive" : "💀 Eliminated"}
                  </span>
                </div>
                {myPlayer.finalRank && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Final rank</span>
                    <span className="text-amber-400 font-bold">#{myPlayer.finalRank}</span>
                  </div>
                )}
              </div>

              {/* Claim prize button */}
              {game.status === "ended" && !game.autoPay && myPlayer.finalRank && myPlayer.finalRank <= game.winnerSplits.length && !myPlayer.claimed && (
                <>
                  {txError && <p className="text-red-400 text-xs mb-2">{txError}</p>}
                  {txStep && <p className="text-emerald-400 text-xs mb-2">{txStep}</p>}
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: "#059669" }}
                  >
                    {claiming ? "⏳ Claiming..." : `🏆 Claim ${prizeForRank(myPlayer.finalRank)}`}
                  </button>
                </>
              )}
              {myPlayer.claimed && (
                <div className="text-center text-emerald-400 text-sm">✅ Prize claimed</div>
              )}
            </div>
          )}

          {/* Admin panel */}
          {isAdmin && (
            <div className="p-5 rounded-2xl border border-amber-600/30" style={{ background: "#0e1420" }}>
              <h3 className="font-bold text-amber-400 mb-3 text-sm uppercase tracking-wider">Admin Panel</h3>
              <Link
                href={`/admin/games/${address}`}
                className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold border border-amber-600/40 text-amber-400 hover:border-amber-500 hover:bg-amber-500/10 transition"
              >
                Manage Game →
              </Link>
            </div>
          )}

          {/* Game info */}
          <div className="p-5 rounded-2xl border space-y-3" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
            <h3 className="text-sm font-semibold text-slate-400">Game info</h3>
            {[
              { label: "Game ID", value: game.gameId },
              { label: "Admin", value: `${game.admin.slice(0,6)}…${game.admin.slice(-4)}` },
              { label: "Mutability", value: game.mutable ? "🔓 Mutable" : "🔒 Immutable" },
              { label: "Payout", value: game.autoPay ? "⚡ Auto" : "✋ Manual claim" },
              { label: "Death messages", value: `${game.deathMessages.length} loaded` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-300 font-mono text-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
