"use client";

import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  fetchProtocolConfig,
  fetchAllSplits,
  fetchVaultBalance,
  updateFee,
  setPaused,
  updateTreasury,
  adminRefund,
  closeSplit,
  type ProtocolConfig,
  type SplitSummary,
} from "@/lib/program";

function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function ExplorerLink({ tx }: { tx: string }) {
  return (
    <a
      href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline opacity-70 hover:opacity-100 ml-2"
    >
      ↗ View tx
    </a>
  );
}

export default function AdminPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  // ── On-chain data ────────────────────────────────────────────────────────
  const [config, setConfig] = useState<ProtocolConfig | null>(null);
  const [splits, setSplits] = useState<SplitSummary[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");

  // ── Local form state ─────────────────────────────────────────────────────
  const [feeBps, setFeeBps] = useState(100);
  const [newTreasury, setNewTreasury] = useState("");

  // ── Action feedback ──────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState("");
  const [actionTx, setActionTx] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!anchorWallet) return;
    setLoadingData(true);
    setDataError("");
    try {
      const [cfg, spl] = await Promise.all([
        fetchProtocolConfig(connection, anchorWallet),
        fetchAllSplits(connection, anchorWallet),
      ]);
      setConfig(cfg);
      if (cfg) {
        setFeeBps(cfg.feeBps);
        setNewTreasury(cfg.treasury);
      }
      setSplits(spl);
    } catch (e: any) {
      setDataError(e.message);
    } finally {
      setLoadingData(false);
    }
  }, [connection, anchorWallet]);

  useEffect(() => {
    if (anchorWallet) loadData();
  }, [anchorWallet, loadData]);

  const isAdmin = config
    ? publicKey?.toBase58() === config.admin
    : false;

  // ── Action helpers ────────────────────────────────────────────────────────
  async function runAction(key: string, fn: () => Promise<string>) {
    setActionLoading(key);
    setActionError((p) => ({ ...p, [key]: "" }));
    setActionTx((p) => ({ ...p, [key]: "" }));
    try {
      const tx = await fn();
      setActionTx((p) => ({ ...p, [key]: tx }));
      await loadData();
    } catch (e: any) {
      setActionError((p) => ({ ...p, [key]: e.message ?? "Error" }));
    } finally {
      setActionLoading("");
    }
  }

  const handleUpdateFee = () =>
    runAction("fee", () =>
      updateFee(connection, anchorWallet!, publicKey!, feeBps)
    );

  const handleTogglePause = () =>
    runAction("pause", () =>
      setPaused(connection, anchorWallet!, publicKey!, !config!.paused)
    );

  const handleUpdateTreasury = () => {
    try { new PublicKey(newTreasury); } catch { return; }
    runAction("treasury", () =>
      updateTreasury(connection, anchorWallet!, publicKey!, new PublicKey(newTreasury))
    );
  };

  const handleRefund = (split: SplitSummary) =>
    runAction(`refund-${split.address}`, () =>
      adminRefund(
        connection,
        anchorWallet!,
        publicKey!,
        split.address,
        split.mint,
        split.creator
      )
    );

  const handleClose = (split: SplitSummary) =>
    runAction(`close-${split.address}`, () =>
      closeSplit(
        connection,
        anchorWallet!,
        publicKey!,
        split.address,
        split.mint,
        config!.treasury  // tokens held safe in treasury
      )
    );

  // ── Gates ─────────────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Slyce Admin</h1>
        <p className="text-white/40 text-sm">Connect admin wallet to continue</p>
        <WalletMultiButton className="!bg-purple-600 !rounded-lg" />
      </main>
    );
  }

  if (loadingData && !config) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 animate-pulse">Loading protocol config…</p>
      </main>
    );
  }

  // Protocol not initialised yet — show init prompt
  if (!config) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">Protocol config not found on devnet.</p>
        <p className="text-white/40 text-sm">Run <code className="font-mono bg-white/10 px-2 py-0.5 rounded">anchor run initialize</code> first.</p>
        {dataError && <p className="text-red-400 text-sm">{dataError}</p>}
        <WalletMultiButton className="!bg-purple-600 !rounded-lg" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
        <p className="text-white/40 text-sm">
          Admin is <span className="font-mono text-white/60">{shortAddr(config.admin)}</span>.
          You are <span className="font-mono text-white/60">{shortAddr(publicKey!.toBase58())}</span>.
        </p>
        <WalletMultiButton className="!bg-purple-600 !rounded-lg" />
      </main>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  const volume = Number(config.totalVolume);
  const fees = Number(config.totalFeesCollected);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">slyce</span>
          <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded-full text-white/60">admin</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${config.paused ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
            {config.paused ? "⏸ PAUSED" : "● LIVE"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loadingData}
            className="text-xs text-white/40 hover:text-white transition disabled:opacity-30"
          >
            {loadingData ? "↻ Loading…" : "↻ Refresh"}
          </button>
          <WalletMultiButton className="!bg-purple-600 !rounded-lg !text-sm" />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Protocol Stats */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Protocol Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Volume", value: volume.toLocaleString() },
              { label: "Fees Collected", value: fees.toLocaleString() },
              { label: "Current Fee", value: `${config.feeBps / 100}% (${config.feeBps} bps)` },
              { label: "Total Splits", value: splits.length },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-white/40">{s.label}</p>
                <p className="text-xl font-bold mt-1 break-all">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-white/30 space-y-0.5">
            <p>Admin: <span className="font-mono">{config.admin}</span></p>
            <p>Treasury: <span className="font-mono">{config.treasury}</span></p>
          </div>
        </section>

        {/* Protocol Controls */}
        <section className="grid md:grid-cols-2 gap-6">

          {/* Fee control */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold">Protocol Fee</h3>
            <p className="text-xs text-white/40">Currently {config.feeBps / 100}%. Max 10% (1000 bps).</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={1000}
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
              />
              <span className="text-white/40 text-sm shrink-0">= {(feeBps / 100).toFixed(2)}%</span>
            </div>
            <button
              onClick={handleUpdateFee}
              disabled={actionLoading === "fee"}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl py-2.5 text-sm font-semibold transition"
            >
              {actionLoading === "fee" ? "Updating…" : "Update Fee"}
            </button>
            {actionTx.fee && (
              <p className="text-xs text-green-400">✓ Updated <ExplorerLink tx={actionTx.fee} /></p>
            )}
            {actionError.fee && (
              <p className="text-xs text-red-400">{actionError.fee}</p>
            )}
          </div>

          {/* Pause control */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold">Protocol Status</h3>
            <div className={`flex items-center gap-2 text-lg font-semibold ${config.paused ? "text-red-400" : "text-green-400"}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${config.paused ? "bg-red-400" : "bg-green-400 animate-pulse"}`} />
              {config.paused ? "PAUSED" : "ACTIVE"}
            </div>
            <p className="text-xs text-white/40">
              Pausing halts all deposits, claims, and distributions.
            </p>
            <button
              onClick={handleTogglePause}
              disabled={actionLoading === "pause"}
              className={`w-full ${config.paused ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} disabled:opacity-50 rounded-xl py-2.5 text-sm font-semibold transition`}
            >
              {actionLoading === "pause"
                ? "Updating…"
                : config.paused
                ? "Resume Protocol"
                : "Pause Protocol"}
            </button>
            {actionTx.pause && (
              <p className="text-xs text-green-400">✓ Done <ExplorerLink tx={actionTx.pause} /></p>
            )}
            {actionError.pause && (
              <p className="text-xs text-red-400">{actionError.pause}</p>
            )}
          </div>

          {/* Treasury control */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 md:col-span-2">
            <h3 className="font-semibold">Treasury Address</h3>
            <p className="text-xs text-white/40">
              Current: <span className="font-mono">{config.treasury}</span>
            </p>
            <div className="flex gap-3">
              <input
                value={newTreasury}
                onChange={(e) => setNewTreasury(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                placeholder="New treasury pubkey"
              />
              <button
                onClick={handleUpdateTreasury}
                disabled={actionLoading === "treasury" || newTreasury === config.treasury}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-xl px-5 text-sm font-semibold transition shrink-0"
              >
                {actionLoading === "treasury" ? "…" : "Update"}
              </button>
            </div>
            {actionTx.treasury && (
              <p className="text-xs text-green-400">✓ Treasury updated <ExplorerLink tx={actionTx.treasury} /></p>
            )}
            {actionError.treasury && (
              <p className="text-xs text-red-400">{actionError.treasury}</p>
            )}
          </div>
        </section>

        {/* Splits table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              All Splits <span className="text-white/30 font-normal text-base">({splits.length})</span>
            </h2>
          </div>

          {splits.length === 0 && (
            <p className="text-white/30 text-sm">No splits on-chain yet.</p>
          )}

          <div className="space-y-3">
            {splits.map((split) => {
              const refundKey = `refund-${split.address}`;
              const deposited = Number(split.totalDeposited);
              const distributed = Number(split.totalDistributed);
              const stuck = deposited > 0 && distributed === 0 && split.locked;

              return (
                <div
                  key={split.address}
                  className="bg-white/5 border border-white/10 rounded-xl px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{split.name}</span>
                        {split.locked && (
                          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                            Locked
                          </span>
                        )}
                        {stuck && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                            Stuck
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/30 font-mono mt-0.5 truncate">
                        {split.address}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        Creator: <span className="font-mono">{shortAddr(split.creator)}</span>
                        {" · "}
                        {split.recipients} recipients
                        {" · "}
                        {new Date(split.createdAt * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-white/40">Deposited / Distributed</p>
                        <p className="text-sm font-semibold">
                          {deposited.toLocaleString()} / {distributed.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRefund(split)}
                        disabled={deposited === 0 || !!actionLoading}
                        title="Return remaining vault tokens to creator"
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                      >
                        {actionLoading === refundKey ? "…" : "Refund"}
                      </button>
                      <button
                        onClick={() => handleClose(split)}
                        disabled={!!actionLoading}
                        title="Refund tokens + close split account (recovers rent)"
                        className="bg-red-700 hover:bg-red-800 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                      >
                        {actionLoading === `close-${split.address}` ? "…" : "Close ✕"}
                      </button>
                    </div>
                  </div>
                  {actionTx[refundKey] && (
                    <p className="text-xs text-green-400 mt-2">
                      ✓ Refunded <ExplorerLink tx={actionTx[refundKey]} />
                    </p>
                  )}
                  {actionError[refundKey] && (
                    <p className="text-xs text-red-400 mt-2">{actionError[refundKey]}</p>
                  )}
                  {actionTx[`close-${split.address}`] && (
                    <p className="text-xs text-green-400 mt-2">
                      ✓ Account closed — rent recovered <ExplorerLink tx={actionTx[`close-${split.address}`]} />
                    </p>
                  )}
                  {actionError[`close-${split.address}`] && (
                    <p className="text-xs text-red-400 mt-2">{actionError[`close-${split.address}`]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
