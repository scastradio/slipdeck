"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  fetchGame, fetchPlayersForGame, OnChainGame, OnChainPlayer,
  getProgram, getProtocolConfigPDA, getPlayerPDA, getVaultPDA,
} from "@/lib/program";
import { KNOWN_TOKENS, SUPER_ADMIN, BASIS_POINTS_DENOM } from "@/lib/constants";

function formatAmount(raw: string, mint: string): string {
  const token = KNOWN_TOKENS.find(t => t.mint === mint);
  const decimals = token?.decimals ?? 6;
  const symbol = token?.symbol ?? "tokens";
  return `${(Number(raw) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`;
}

export default function AdminGamePage() {
  const params = useParams();
  const address = params.address as string;
  const { connection } = useConnection();
  const wallet = useWallet();

  const [game, setGame] = useState<OnChainGame | null>(null);
  const [players, setPlayers] = useState<OnChainPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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

  const isSuperAdmin = wallet.publicKey?.toBase58() === SUPER_ADMIN;
  const isAdmin = game && (wallet.publicKey?.toBase58() === game.admin || isSuperAdmin);

  const tx = async (fn: () => Promise<void>) => {
    setBusy(true);
    setTxError("");
    try { await fn(); await load(); }
    catch (e: unknown) { setTxError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setTxStep(""); }
  };

  const handleStart = () => tx(async () => {
    setTxStep("Starting game...");
    const program = getProgram(connection, wallet);
    const [configPDA] = getProtocolConfigPDA();
    await (program.methods as any).startGame()
      .accounts({ protocolConfig: configPDA, game: new PublicKey(address), authority: wallet.publicKey })
      .rpc();
    setTxStep("✅ Game started!");
  });

  const handleEliminate = (player: OnChainPlayer, msgIdx: number) => tx(async () => {
    setTxStep(`Eliminating #${player.entryNumber}...`);
    const program = getProgram(connection, wallet);
    const [configPDA] = getProtocolConfigPDA();
    const [playerPDA] = getPlayerPDA(new PublicKey(address), new PublicKey(player.player));
    await (program.methods as any).eliminatePlayer(msgIdx, null)
      .accounts({
        protocolConfig: configPDA,
        game: new PublicKey(address),
        playerAccount: playerPDA,
        authority: wallet.publicKey,
      })
      .rpc();
    setTxStep(`✅ #${player.entryNumber} eliminated`);
  });

  const handleSetRank = (player: OnChainPlayer, rank: number) => tx(async () => {
    setTxStep(`Setting rank #${rank} for player #${player.entryNumber}...`);
    const program = getProgram(connection, wallet);
    const [configPDA] = getProtocolConfigPDA();
    const [playerPDA] = getPlayerPDA(new PublicKey(address), new PublicKey(player.player));
    await (program.methods as any).setWinnerRank(rank)
      .accounts({
        protocolConfig: configPDA,
        game: new PublicKey(address),
        playerAccount: playerPDA,
        authority: wallet.publicKey,
      })
      .rpc();
    setTxStep(`✅ Rank #${rank} set`);
  });

  const handlePayWinner = (player: OnChainPlayer) => tx(async () => {
    if (!game) return;
    setTxStep(`Paying winner #${player.entryNumber}...`);
    const program = getProgram(connection, wallet);
    const [configPDA] = getProtocolConfigPDA();
    const [playerPDA] = getPlayerPDA(new PublicKey(address), new PublicKey(player.player));
    const [vaultPDA] = getVaultPDA(BigInt(game.gameId));
    const mintKey = new PublicKey(game.mint);
    const winnerATA = await getAssociatedTokenAddress(mintKey, new PublicKey(player.player));
    await (program.methods as any).payWinner()
      .accounts({
        protocolConfig: configPDA,
        game: new PublicKey(address),
        playerAccount: playerPDA,
        vault: vaultPDA,
        winnerTokenAccount: winnerATA,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    setTxStep(`✅ Winner #${player.entryNumber} paid`);
  });

  const handleCollectProfit = () => tx(async () => {
    if (!game || !wallet.publicKey) return;
    setTxStep("Collecting admin profit...");
    const program = getProgram(connection, wallet);
    const [configPDA] = getProtocolConfigPDA();
    const [vaultPDA] = getVaultPDA(BigInt(game.gameId));
    const mintKey = new PublicKey(game.mint);
    const adminATA = await getAssociatedTokenAddress(mintKey, wallet.publicKey);
    await (program.methods as any).collectAdminProfit()
      .accounts({
        protocolConfig: configPDA,
        game: new PublicKey(address),
        vault: vaultPDA,
        adminTokenAccount: adminATA,
        admin: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    setTxStep("✅ Profit collected");
  });

  const handleForceClose = () => tx(async () => {
    setTxStep("Force closing game...");
    const program = getProgram(connection, wallet);
    const [configPDA] = getProtocolConfigPDA();
    await (program.methods as any).forceCloseGame()
      .accounts({ protocolConfig: configPDA, game: new PublicKey(address), authority: wallet.publicKey })
      .rpc();
    setTxStep("✅ Game force-closed");
  });

  const handleDrain = () => tx(async () => {
    if (!game || !wallet.publicKey) return;
    setTxStep("Draining game funds...");
    const program = getProgram(connection, wallet);
    const [configPDA] = getProtocolConfigPDA();
    const [vaultPDA] = getVaultPDA(BigInt(game.gameId));
    const mintKey = new PublicKey(game.mint);
    const adminATA = await getAssociatedTokenAddress(mintKey, wallet.publicKey);
    await (program.methods as any).adminDrainGame()
      .accounts({
        protocolConfig: configPDA,
        game: new PublicKey(address),
        vault: vaultPDA,
        adminTokenAccount: adminATA,
        admin: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    setTxStep("✅ Funds drained");
  });

  const aliveList = players.filter(p => p.alive);
  const eliminatedList = players.filter(p => !p.alive);

  if (!wallet.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
        <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px" }} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
        <div className="text-slate-500 text-center"><div className="animate-spin text-4xl mb-3">⏳</div><p>Loading...</p></div>
      </div>
    );
  }

  if (!game || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
        <div className="text-center">
          <p className="text-slate-400 mb-4">Game not found or access denied.</p>
          <Link href="/" className="text-amber-400 hover:underline">← Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#080c14" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link href={`/games/${address}`} className="text-slate-400 hover:text-white text-sm">← Game page</Link>
          <span className="text-amber-400 text-sm font-semibold">Admin Panel</span>
        </div>
        <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px", fontSize: "13px", height: "34px" }} />
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Game header */}
        <div className="p-6 rounded-2xl border" style={{ background: "#0e1420", borderColor: "#d97706" }}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">{game.name}</h1>
              <p className="text-slate-400 text-sm mt-1">{game.theme || "No theme"}</p>
            </div>
            <div className="text-right">
              <div className="text-amber-400 font-bold text-xl">{formatAmount(game.totalPot, game.mint)}</div>
              <div className="text-slate-500 text-xs">prize pool</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
            {[
              { label: "Status", value: game.status.toUpperCase() },
              { label: "Players", value: `${game.playerCount}` },
              { label: "Alive", value: `${aliveList.length}` },
              { label: "Eliminated", value: `${eliminatedList.length}` },
            ].map(({ label, value }) => (
              <div key={label} className="p-2 rounded-lg text-center" style={{ background: "#080c14" }}>
                <div className="text-xs text-slate-500">{label}</div>
                <div className="font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status messages */}
        {txError && <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">{txError}</div>}
        {txStep && <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400 text-sm flex gap-2"><span className="animate-spin">⏳</span> {txStep}</div>}

        {/* Action buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {game.status === "pending" && (
            <button onClick={handleStart} disabled={busy || game.playerCount < 2}
              className="p-4 rounded-xl font-semibold text-white transition disabled:opacity-40"
              style={{ background: "#16a34a" }}>
              ⚔️ Start Game
            </button>
          )}
          {game.status === "ended" && game.autoPay && (
            <>
              {aliveList.filter(p => p.finalRank && p.finalRank <= game.winnerSplits.length && !p.claimed).map(p => (
                <button key={p.address} onClick={() => handlePayWinner(p)} disabled={busy}
                  className="p-4 rounded-xl font-semibold text-white transition disabled:opacity-40"
                  style={{ background: "#0ea5e9" }}>
                  💰 Pay Rank #{p.finalRank}
                </button>
              ))}
              <button onClick={handleCollectProfit} disabled={busy}
                className="p-4 rounded-xl font-semibold text-white transition disabled:opacity-40"
                style={{ background: "#7c3aed" }}>
                💼 Collect Profit
              </button>
            </>
          )}
          {game.status === "ended" && !game.autoPay && (
            <button onClick={handleCollectProfit} disabled={busy}
              className="p-4 rounded-xl font-semibold text-white transition disabled:opacity-40"
              style={{ background: "#7c3aed" }}>
              💼 Collect Admin Profit
            </button>
          )}
          {isSuperAdmin && game.status !== "ended" && game.status !== "cancelled" && (
            <button onClick={handleForceClose} disabled={busy}
              className="p-4 rounded-xl font-semibold text-white transition disabled:opacity-40"
              style={{ background: "#dc2626" }}>
              🚫 Force Close
            </button>
          )}
          {game.mutable && (game.status === "pending" || game.status === "active") && (
            <button onClick={handleDrain} disabled={busy}
              className="p-4 rounded-xl font-semibold text-white transition disabled:opacity-40 col-span-2 sm:col-span-1"
              style={{ background: "#92400e" }}>
              💸 Drain & Stop
            </button>
          )}
        </div>

        {/* Alive fighters — elimination controls */}
        {game.status === "active" && aliveList.length > 0 && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
            <div className="px-4 py-3 border-b" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
              <h3 className="font-semibold text-white">⚔️ Alive fighters ({aliveList.length})</h3>
              <p className="text-xs text-slate-500 mt-0.5">Click Eliminate to remove from the game</p>
            </div>
            <div className="divide-y divide-slate-900">
              {aliveList.map((p, i) => (
                <div key={p.address} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-white font-mono text-sm">#{p.entryNumber}</span>
                    <span className="text-slate-500 font-mono text-xs ml-2">
                      {p.player.slice(0, 8)}…{p.player.slice(-4)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleEliminate(p, i % Math.max(1, game.deathMessages.length))}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition disabled:opacity-40"
                  >
                    💀 Eliminate
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Winners — set rank controls */}
        {(game.status === "ended" || game.status === "active") && aliveList.length > 0 && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
            <div className="px-4 py-3 border-b" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
              <h3 className="font-semibold text-white">🏆 Set winner ranks</h3>
              <p className="text-xs text-slate-500 mt-0.5">Assign final ranks to surviving players before paying out</p>
            </div>
            <div className="divide-y divide-slate-900">
              {aliveList.map((p, i) => (
                <div key={p.address} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-white font-mono text-sm">#{p.entryNumber}</span>
                    <span className="text-slate-500 font-mono text-xs ml-2">{p.player.slice(0,8)}…</span>
                    {p.finalRank && <span className="ml-2 text-amber-400 text-xs font-bold">→ Rank #{p.finalRank}</span>}
                  </div>
                  <div className="flex gap-2">
                    {Array.from({ length: Math.min(game.winnerSplits.length, 5) }, (_, j) => j + 1).map(rank => (
                      <button key={rank}
                        onClick={() => handleSetRank(p, rank)}
                        disabled={busy}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition disabled:opacity-40 ${
                          p.finalRank === rank ? "bg-amber-500/30 text-amber-300 border border-amber-500/50" : "border border-slate-700 text-slate-400 hover:border-amber-500/50 hover:text-amber-400"
                        }`}>
                        #{rank}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Eliminated log */}
        {eliminatedList.length > 0 && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
            <div className="px-4 py-3 border-b" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
              <h3 className="font-semibold text-slate-400">💀 Eliminated ({eliminatedList.length})</h3>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-900">
              {eliminatedList.map(p => (
                <div key={p.address} className="px-4 py-2.5 text-sm" style={{ background: "#0d0808" }}>
                  <span className="text-slate-500 font-mono text-xs">#{p.entryNumber}</span>
                  {p.deathMessage && <span className="text-red-400/70 italic text-xs ml-2">{p.deathMessage}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
