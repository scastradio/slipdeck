// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  fetchAllGames,
  gameStatusLabel,
  formatAmount,
  shortAddress,
  getProgram,
  getSuperConfigPDA,
} from "@/lib/program";
import { fetchSuperConfig } from "@/lib/superconfig";
import { PublicKey } from "@solana/web3.js";

export default function SuperAdminPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [superConfig, setSuperConfig] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (wallet.connected && wallet.publicKey) loadData();
  }, [wallet.connected, wallet.publicKey, connection]);

  async function loadData() {
    setLoading(true);
    try {
      const [cfg, allGames] = await Promise.all([
        fetchSuperConfig(connection, wallet),
        fetchAllGames(connection, wallet),
      ]);
      setSuperConfig(cfg);
      setGames(allGames);
      setIsSuperAdmin(cfg.superAdmin.toBase58() === wallet.publicKey?.toBase58());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleCloseGame(gameAddress: string, mintAddress: string, treasuryAddress: string) {
    if (!wallet.publicKey) return;
    setError(""); setSuccess(""); setTxPending(true);
    try {
      const program = getProgram(connection, wallet);
      const [superConfigPDA] = getSuperConfigPDA();
      const gamePubkey = new PublicKey(gameAddress);
      const mintPubkey = new PublicKey(mintAddress);
      const treasuryPubkey = new PublicKey(treasuryAddress);

      const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
      const { SystemProgram, SYSVAR_RENT_PUBKEY } = await import("@solana/web3.js");

      const gameVault = getAssociatedTokenAddressSync(mintPubkey, gamePubkey, true);
      const treasuryTokenAccount = getAssociatedTokenAddressSync(mintPubkey, treasuryPubkey);

      await program.methods
        .adminCloseGame()
        .accounts({
          game: gamePubkey,
          superConfig: superConfigPDA,
          superAdmin: wallet.publicKey,
          gameVault,
          treasuryTokenAccount,
          treasury: treasuryPubkey,
          mint: mintPubkey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      setSuccess("Game closed and funds drained to treasury.");
      await loadData();
    } catch (e) {
      setError(e.message || "Failed");
    }
    setTxPending(false);
  }

  if (!wallet.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--text)" }}>🔴 Super Admin</h1>
          {!isSuperAdmin && !loading && (
            <p className="text-sm mt-1 text-red-400">⚠️ Your wallet is not the super admin</p>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/admin"><span className="text-sm" style={{ color: "var(--text-muted)" }}>← Admin</span></Link>
          <WalletMultiButton />
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 text-red-400 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-lg bg-emerald-900/20 text-emerald-400 text-sm">{success}</div>}

      {/* Protocol Stats */}
      {superConfig && (
        <div
          className="rounded-2xl p-6 border mb-8"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>Protocol Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Super Admin</p>
              <p className="font-mono text-xs" style={{ color: "var(--text)" }}>{shortAddress(superConfig.superAdmin.toBase58())}</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Treasury</p>
              <p className="font-mono text-xs" style={{ color: "var(--text)" }}>{shortAddress(superConfig.treasury.toBase58())}</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Total Games</p>
              <p className="font-bold" style={{ color: "var(--text)" }}>{superConfig.totalGames.toString()}</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Fees Collected</p>
              <p className="font-bold" style={{ color: "#f87171" }}>{formatAmount(superConfig.totalFeesCollected)}</p>
            </div>
          </div>
          <div className="mt-3">
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                background: superConfig.paused ? "rgba(220,38,38,0.15)" : "rgba(52,211,153,0.1)",
                color: superConfig.paused ? "#f87171" : "#34d399",
              }}
            >
              {superConfig.paused ? "🔴 PAUSED" : "🟢 ACTIVE"}
            </span>
          </div>
        </div>
      )}

      {/* All Games */}
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>All Games ({games.length})</h2>
      {loading && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>}
      <div className="space-y-3">
        {games.map((g) => {
          const status = gameStatusLabel(g.account.status);
          const canClose = status === "OPEN" || status === "LIVE" || status === "ACTIVE";
          return (
            <div
              key={g.publicKey.toBase58()}
              className="rounded-xl p-4 border"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{g.account.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {status} · {g.account.playerCount} players · Pot: {formatAmount(g.account.totalPot)}
                    · Creator: {shortAddress(g.account.creator.toBase58())}
                  </p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {shortAddress(g.publicKey.toBase58())}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/games/${g.publicKey.toBase58()}`}>
                    <button className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      View
                    </button>
                  </Link>
                  {isSuperAdmin && canClose && (
                    <button
                      onClick={() => handleCloseGame(
                        g.publicKey.toBase58(),
                        g.account.entryMint.toBase58(),
                        superConfig.treasury.toBase58()
                      )}
                      disabled={txPending}
                      className="text-xs px-3 py-1.5 rounded font-bold"
                      style={{ background: "rgba(220,38,38,0.2)", color: "#f87171" }}
                    >
                      Force Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
