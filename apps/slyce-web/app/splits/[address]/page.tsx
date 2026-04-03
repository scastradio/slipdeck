"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect, useCallback } from "react";
import {
  fetchSplit,
  fetchVaultBalance,
  deposit as doDeposit,
  claim as doClaim,
  type OnChainSplit,
  type DistributionMode,
} from "@/lib/program";
import { SUPPORTED_TOKENS } from "@/lib/constants";

function mintInfo(mint: string) {
  return (
    SUPPORTED_TOKENS.find((t) => t.mint === mint) ?? {
      symbol: mint.slice(0, 6) + "…",
      decimals: 6,
      name: "SPL Token",
    }
  );
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function distributionModeLabel(mode: DistributionMode) {
  if (mode === "percentage") return "Percentage";
  if (mode === "fixed") return "Fixed";
  return "Equal";
}

function distributionModeBadgeClass(mode: DistributionMode) {
  if (mode === "percentage") return "bg-purple-500/20 text-purple-400";
  if (mode === "fixed") return "bg-blue-500/20 text-blue-400";
  return "bg-green-500/20 text-green-400";
}

function computeClaimable(
  mode: DistributionMode,
  vaultBalance: number,
  shareValue: number,
  numRecipients: number
): number {
  if (vaultBalance <= 0) return 0;
  if (mode === "percentage") {
    return (vaultBalance * shareValue) / 10_000;
  }
  if (mode === "fixed") {
    // share_value is in raw units; vault balance is ui amount
    // We display fixed amount but cap at vault
    return Math.min(shareValue, vaultBalance);
  }
  // equal
  return vaultBalance / numRecipients;
}

export default function SplitDetail() {
  const { address } = useParams<{ address: string }>();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const [split, setSplit] = useState<OnChainSplit | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositTx, setDepositTx] = useState("");
  const [depositError, setDepositError] = useState("");

  const [claimLoading, setClaimLoading] = useState(false);
  const [claimTx, setClaimTx] = useState("");
  const [claimError, setClaimError] = useState("");

  const loadData = useCallback(async () => {
    if (!anchorWallet || !address) return;
    setLoadingData(true);
    setDataError("");
    try {
      const [s] = await Promise.all([
        fetchSplit(connection, anchorWallet, address),
        Promise.resolve(0),
      ]);
      if (!s) {
        setDataError("Split not found on-chain.");
        return;
      }
      setSplit(s);
      const bal = await fetchVaultBalance(connection, address, s.mint);
      setVaultBalance(bal);
    } catch (e: any) {
      setDataError(e.message);
    } finally {
      setLoadingData(false);
    }
  }, [connection, anchorWallet, address]);

  useEffect(() => {
    if (anchorWallet) loadData();
  }, [anchorWallet, loadData]);

  const handleDeposit = async () => {
    if (!connected || !anchorWallet || !publicKey || !split) return;
    setDepositLoading(true);
    setDepositError("");
    setDepositTx("");
    try {
      const token = mintInfo(split.mint);
      const { tx } = await doDeposit(
        connection,
        anchorWallet,
        publicKey,
        address,
        split.mint,
        Number(depositAmount),
        token.decimals
      );
      setDepositTx(tx);
      setDepositAmount("");
      const bal = await fetchVaultBalance(connection, address, split.mint);
      setVaultBalance(bal);
      const updated = await fetchSplit(connection, anchorWallet, address);
      if (updated) setSplit(updated);
    } catch (e: any) {
      setDepositError(e.message ?? "Deposit failed");
    } finally {
      setDepositLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!connected || !anchorWallet || !publicKey || !split) return;
    setClaimLoading(true);
    setClaimError("");
    setClaimTx("");
    try {
      const { tx } = await doClaim(
        connection,
        anchorWallet,
        publicKey,
        address,
        split.mint
      );
      setClaimTx(tx);
      const bal = await fetchVaultBalance(connection, address, split.mint);
      setVaultBalance(bal);
      const updated = await fetchSplit(connection, anchorWallet, address);
      if (updated) setSplit(updated);
    } catch (e: any) {
      setClaimError(e.message ?? "Claim failed");
    } finally {
      setClaimLoading(false);
    }
  };

  const token = split ? mintInfo(split.mint) : null;
  const myRecipientEntry = split?.recipients.find(
    (r) => r.address === publicKey?.toBase58()
  );
  const isRecipient = !!myRecipientEntry;

  const numRecipients = split?.recipients.length ?? 1;
  const myClaimable = isRecipient && split
    ? computeClaimable(
        split.distributionMode,
        vaultBalance,
        myRecipientEntry?.share_value ?? 0,
        numRecipients
      )
    : 0;

  const totalDeposited = Number(split?.totalDeposited ?? 0);
  const totalDistributed = Number(split?.totalDistributed ?? 0);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (!connected) {
    return (
      <main className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-white/50">Connect your wallet to view this split</p>
        <WalletMultiButton className="!bg-purple-600 !rounded-lg" />
      </main>
    );
  }

  if (loadingData) {
    return (
      <main className="min-h-screen bg-[#080c14] text-white">
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
          <Link href="/" className="text-xl font-bold tracking-tight">slyce</Link>
          <WalletMultiButton className="!bg-purple-600 !rounded-lg !text-sm" />
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/5 rounded-2xl animate-pulse h-24" />
          ))}
        </div>
      </main>
    );
  }

  if (dataError || !split) {
    return (
      <main className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{dataError || "Split not found"}</p>
        <Link href="/splits" className="text-purple-400 hover:text-purple-300 text-sm">
          ← Back to splits
        </Link>
      </main>
    );
  }

  // ─── Main ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#080c14] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
        <Link href="/" className="text-xl font-bold tracking-tight">slyce</Link>
        <WalletMultiButton className="!bg-purple-600 !rounded-lg !text-sm" />
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

        {/* Breadcrumb + Header */}
        <div>
          <Link href="/splits" className="text-white/40 hover:text-white text-sm transition">
            ← Splits
          </Link>
          <div className="flex items-start justify-between mt-3">
            <div>
              <h1 className="text-3xl font-bold">{split.name || "Unnamed Split"}</h1>
              {split.description && (
                <p className="text-white/50 mt-1">{split.description}</p>
              )}
              <p className="text-xs text-white/30 font-mono mt-2">{address}</p>
            </div>
            <div className="flex flex-col gap-1 items-end shrink-0 ml-4">
              {split.locked && (
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
                  Locked
                </span>
              )}
              {split.autoDistribute && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  Auto-distribute
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded-full ${distributionModeBadgeClass(split.distributionMode)}`}>
                {distributionModeLabel(split.distributionMode)}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total Deposited",
              value: `${totalDeposited.toLocaleString()} ${token?.symbol}`,
            },
            {
              label: "Total Distributed",
              value: `${totalDistributed.toLocaleString()} ${token?.symbol}`,
            },
            {
              label: "In Vault",
              value: `${vaultBalance.toLocaleString()} ${token?.symbol}`,
              highlight: vaultBalance > 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`border rounded-xl p-4 ${
                stat.highlight
                  ? "bg-purple-500/10 border-purple-500/30"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <p className="text-xs text-white/40">{stat.label}</p>
              <p className="text-xl font-semibold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Equal mode info */}
        {split.distributionMode === "equal" && vaultBalance > 0 && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
            ✦ Equal split — ~{(vaultBalance / numRecipients).toFixed(4)} {token?.symbol} per recipient
          </div>
        )}

        {/* My claimable banner */}
        {isRecipient && myClaimable > 0 && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-purple-300">Your claimable balance</p>
              <p className="text-2xl font-bold text-white mt-1">
                ~{myClaimable.toFixed(4)} {token?.symbol}
              </p>
              {split.distributionMode === "percentage" && (
                <p className="text-xs text-white/40 mt-0.5">
                  {(myRecipientEntry?.share_value ?? 0) / 100}% of vault
                </p>
              )}
              {split.distributionMode === "fixed" && (
                <p className="text-xs text-white/40 mt-0.5">
                  Fixed amount
                </p>
              )}
              {split.distributionMode === "equal" && (
                <p className="text-xs text-white/40 mt-0.5">
                  1/{numRecipients} of vault
                </p>
              )}
            </div>
            <button
              onClick={handleClaim}
              disabled={claimLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition text-sm shrink-0"
            >
              {claimLoading ? "Claiming…" : "Claim →"}
            </button>
          </div>
        )}

        {/* Claim feedback */}
        {claimTx && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
            ✓ Claimed!{" "}
            <a
              href={`https://explorer.solana.com/tx/${claimTx}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline opacity-70 hover:opacity-100"
            >
              View tx ↗
            </a>
          </div>
        )}
        {claimError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            {claimError}
          </div>
        )}

        {/* Deposit box */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Deposit to this Split</h2>
            <p className="text-xs text-white/40 mt-1">
              1% protocol fee on deposit · vault receives 99%
            </p>
          </div>

          <div className="flex gap-3">
            <input
              type="number"
              min="0"
              step="any"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder={`Amount (${token?.symbol})`}
              className="flex-1 bg-[#080c14]/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleDeposit}
              disabled={!connected || depositLoading || !depositAmount || Number(depositAmount) <= 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-semibold px-5 rounded-xl transition text-sm"
            >
              {depositLoading ? "…" : "Deposit"}
            </button>
          </div>

          {depositAmount && Number(depositAmount) > 0 && (
            <p className="text-xs text-white/40">
              Fee: {(Number(depositAmount) * 0.01).toFixed(6)} {token?.symbol} ·
              Vault receives: {(Number(depositAmount) * 0.99).toFixed(6)} {token?.symbol}
            </p>
          )}

          {depositTx && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
              ✓ Deposited!{" "}
              <a
                href={`https://explorer.solana.com/tx/${depositTx}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline opacity-70 hover:opacity-100"
              >
                View tx ↗
              </a>
            </div>
          )}
          {depositError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {depositError}
            </div>
          )}
        </div>

        {/* Recipients */}
        <div>
          <h2 className="font-semibold mb-3">
            Recipients <span className="text-white/30 font-normal">({split.recipients.length})</span>
          </h2>
          <div className="space-y-2">
            {split.recipients.map((r, i) => {
              const isMe = r.address === publicKey?.toBase58();
              const claimable = computeClaimable(
                split.distributionMode,
                vaultBalance,
                r.share_value,
                numRecipients
              );
              return (
                <div
                  key={i}
                  className={`border rounded-xl px-4 py-3 flex items-center justify-between ${
                    isMe
                      ? "bg-purple-500/10 border-purple-500/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {r.label || "Unnamed"}
                      </span>
                      {isMe && (
                        <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/30 font-mono mt-0.5">
                      {shortAddr(r.address)}
                    </p>
                  </div>
                  <div className="text-right">
                    {split.distributionMode === "percentage" && (
                      <p className="text-sm font-semibold text-purple-400">
                        {r.share_value / 100}%
                      </p>
                    )}
                    {split.distributionMode === "fixed" && (
                      <p className="text-sm font-semibold text-blue-400">
                        Fixed amount
                      </p>
                    )}
                    {split.distributionMode === "equal" && (
                      <p className="text-sm font-semibold text-green-400">
                        Equal share
                      </p>
                    )}
                    {vaultBalance > 0 && (
                      <p className="text-xs text-white/40">
                        ~{claimable.toFixed(4)} {token?.symbol} claimable
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Meta */}
        <div className="border-t border-white/5 pt-6 text-xs text-white/30 space-y-1">
          <p>Creator: <span className="font-mono">{shortAddr(split.creator)}</span></p>
          <p>Token: <span className="font-mono">{split.mint}</span></p>
          <p>Mode: {distributionModeLabel(split.distributionMode)}</p>
          <p>Created: {new Date(split.createdAt * 1000).toLocaleDateString()}</p>
        </div>
      </div>
    </main>
  );
}
