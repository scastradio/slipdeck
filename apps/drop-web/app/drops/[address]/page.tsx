"use client";

import { useEffect, useState, use } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { fetchAirdrop, fetchVaultBalance, executePush, claimAirdrop, resetRecipient, OnChainAirdrop } from "@/lib/program";
import { KNOWN_TOKENS } from "@/lib/constants";

function getTokenSymbol(mint: string): string {
  const t = KNOWN_TOKENS.find((t) => t.mint === mint);
  return t?.symbol ?? mint.slice(0, 8) + "...";
}

function getTokenDecimals(mint: string): number {
  const t = KNOWN_TOKENS.find((t) => t.mint === mint);
  return t?.decimals ?? 6;
}

function formatAmount(raw: string, mint: string, dp = 2): string {
  const decimals = getTokenDecimals(mint);
  return (parseFloat(raw) / 10 ** decimals).toFixed(dp);
}

function short(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function AirdropDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const { connection } = useConnection();
  const wallet = useWallet();

  const [airdrop, setAirdrop] = useState<OnChainAirdrop | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Push execution state
  const [pushLoading, setPushLoading] = useState(false);
  const [pushProgress, setPushProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [pushError, setPushError] = useState("");
  const [failedIndices, setFailedIndices] = useState<number[]>([]);

  // Reset state
  const [resetLoading, setResetLoading] = useState<number | null>(null);
  const [resetError, setResetError] = useState("");
  const [resetTx, setResetTx] = useState("");

  // Claim state
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);

  async function reload() {
    const dummyWallet = {
      publicKey: null,
      signTransaction: async (tx: unknown) => tx,
      signAllTransactions: async (txs: unknown[]) => txs,
    };
    const data = await fetchAirdrop(connection, dummyWallet, address);
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setAirdrop(data);
    const bal = await fetchVaultBalance(connection, address, data.mint);
    setVaultBalance(bal);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, connection]);

  const myWallet = wallet.publicKey?.toBase58();
  const isCreator = airdrop && myWallet && airdrop.creator === myWallet;
  const claimedCount = airdrop?.recipients.filter((r) => r.claimed).length ?? 0;
  const totalCount = airdrop?.recipients.length ?? 0;
  const progress = totalCount > 0 ? (claimedCount / totalCount) * 100 : 0;

  const myRecipient = airdrop?.recipients.find((r) => r.wallet === myWallet);
  const canClaim =
    airdrop?.mode === "claim" &&
    airdrop?.status === "active" &&
    myRecipient &&
    !myRecipient.claimed;

  const unclaimedRecipients = airdrop?.recipients
    .map((r, i) => ({ ...r, index: i }))
    .filter((r) => !r.claimed) ?? [];

  const canExecutePush =
    airdrop?.mode === "push" &&
    airdrop?.status === "active" &&
    unclaimedRecipients.length > 0 &&
    wallet.connected;

  const handleExecutePushAll = async () => {
    if (!wallet.publicKey || !airdrop) return;
    setPushLoading(true);
    setPushError("");
    setFailedIndices([]);
    const todo = unclaimedRecipients;
    setPushProgress({ done: 0, total: todo.length, current: "" });
    const newFailed: number[] = [];

    for (let i = 0; i < todo.length; i++) {
      const r = todo[i];
      setPushProgress({ done: i, total: todo.length, current: r.wallet });
      try {
        await executePush(
          connection,
          wallet,
          wallet.publicKey,
          address,
          airdrop.mint,
          r.index,
          r.wallet
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        newFailed.push(r.index);
        // Don't abort — continue trying the rest
        console.error(`Failed at recipient ${r.index}: ${msg}`);
      }
    }

    setFailedIndices(newFailed);
    if (newFailed.length > 0) {
      setPushError(`${newFailed.length} recipient${newFailed.length > 1 ? "s" : ""} failed. You can reset & retry them individually, or retry all failed below.`);
    }
    setPushProgress({ done: todo.length - newFailed.length, total: todo.length, current: "" });
    setPushLoading(false);
    await reload();
  };

  const handleRetryFailed = async () => {
    if (!wallet.publicKey || !airdrop || failedIndices.length === 0) return;
    setPushLoading(true);
    setPushError("");
    const todo = failedIndices.map(i => ({ ...airdrop.recipients[i], index: i }));
    setPushProgress({ done: 0, total: todo.length, current: "" });
    const stillFailed: number[] = [];

    for (let i = 0; i < todo.length; i++) {
      const r = todo[i];
      setPushProgress({ done: i, total: todo.length, current: r.wallet });
      try {
        await executePush(
          connection,
          wallet,
          wallet.publicKey,
          address,
          airdrop.mint,
          r.index,
          r.wallet
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        stillFailed.push(r.index);
        console.error(`Retry failed at ${r.index}: ${msg}`);
      }
    }

    setFailedIndices(stillFailed);
    if (stillFailed.length > 0) {
      setPushError(`${stillFailed.length} still failing. Try resetting the recipient on-chain first.`);
    } else {
      setPushError("");
    }
    setPushProgress({ done: todo.length - stillFailed.length, total: todo.length, current: "" });
    setPushLoading(false);
    await reload();
  };

  const handleResetRecipient = async (recipientIndex: number) => {
    if (!wallet.publicKey || !airdrop) return;
    setResetLoading(recipientIndex);
    setResetError("");
    setResetTx("");
    try {
      const tx = await resetRecipient(
        connection,
        wallet,
        wallet.publicKey,
        address,
        recipientIndex
      );
      setResetTx(tx);
      await reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setResetError(msg);
    } finally {
      setResetLoading(null);
    }
  };

  const handleClaim = async () => {
    if (!wallet.publicKey || !airdrop) return;
    setClaimLoading(true);
    setClaimError("");
    try {
      await claimAirdrop(connection, wallet, wallet.publicKey, address, airdrop.mint);
      setClaimSuccess(true);
      await reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setClaimError(msg);
    } finally {
      setClaimLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c10" }}>
        <div className="text-slate-500 flex items-center gap-3">
          <span className="animate-spin text-xl">⏳</span> Loading airdrop...
        </div>
      </div>
    );
  }

  if (notFound || !airdrop) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c10" }}>
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Airdrop not found</h1>
          <p className="text-slate-400 mb-6">This address doesn&apos;t exist on devnet.</p>
          <Link href="/drops" className="text-sky-400 hover:text-sky-300">← Back to airdrops</Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, { text: string; dot: string }> = {
    pending: { text: "#fbbf24", dot: "#fbbf24" },
    active: { text: "#22c55e", dot: "#22c55e" },
    complete: { text: "#0ea5e9", dot: "#0ea5e9" },
    drained: { text: "#6b7280", dot: "#6b7280" },
  };
  const sc = statusColors[airdrop.status] ?? statusColors.pending;

  return (
    <div className="min-h-screen" style={{ background: "#080c10" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold" style={{ color: "#0ea5e9" }}>Drop</Link>
          <span className="text-slate-600">/</span>
          <Link href="/drops" className="text-slate-400 text-sm hover:text-slate-200">Airdrops</Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 text-sm font-mono">{short(address)}</span>
        </div>
        <WalletMultiButton style={{
          background: "#0ea5e9", color: "#fff", borderRadius: "8px",
          fontSize: "14px", height: "36px", padding: "0 16px",
        }} />
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {/* Header */}
        <div className="p-6 rounded-xl border" style={{ background: "#0d1117", borderColor: "#1e293b" }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">{airdrop.name || "Unnamed airdrop"}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-sm font-medium flex items-center gap-1.5"
                  style={{ color: sc.text }}
                >
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: sc.dot }} />
                  {airdrop.status.charAt(0).toUpperCase() + airdrop.status.slice(1)}
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: airdrop.mode === "push" ? "#0ea5e9" : "#8b5cf6" }}
                >
                  {airdrop.mode === "push" ? "⚡ Push mode" : "✋ Claim mode"}
                </span>
                {isCreator && (
                  <span className="text-xs px-2 py-0.5 rounded-full border"
                    style={{ background: "#0ea5e910", borderColor: "#0ea5e940", color: "#0ea5e9" }}>
                    you created this
                  </span>
                )}
              </div>
            </div>
            <a
              href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 flex-shrink-0"
            >
              Explorer ↗
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">Token</div>
              <div className="text-white font-semibold">{getTokenSymbol(airdrop.mint)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Total tokens</div>
              <div className="text-white font-semibold">
                {formatAmount(airdrop.totalTokens, airdrop.mint)} {getTokenSymbol(airdrop.mint)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Vault balance</div>
              <div className="text-white font-semibold">
                {vaultBalance.toFixed(2)} {getTokenSymbol(airdrop.mint)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Creator</div>
              <div className="text-white font-mono text-sm">{short(airdrop.creator)}</div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="p-5 rounded-xl border" style={{ background: "#0d1117", borderColor: "#1e293b" }}>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-400">
              {claimedCount} of {totalCount} recipients {airdrop.mode === "claim" ? "claimed" : "paid"}
            </span>
            <span className="text-sm font-mono" style={{ color: "#0ea5e9" }}>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "#1e293b" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: progress === 100 ? "#22c55e" : "#0ea5e9" }}
            />
          </div>
        </div>

        {/* Actions */}
        {/* Push execute */}
        {canExecutePush && (
          <div className="p-5 rounded-xl border" style={{ background: "#0d1117", borderColor: "#0ea5e930" }}>
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span>⚡</span> Execute Push
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {unclaimedRecipients.length} recipients still waiting. Approve one transaction per recipient.
            </p>

            {pushProgress && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>
                    Sending to {pushProgress.current ? short(pushProgress.current) : "..."}</span>
                  <span>{pushProgress.done}/{pushProgress.total}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1e293b" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(pushProgress.done / pushProgress.total) * 100}%`,
                      background: "#0ea5e9",
                    }}
                  />
                </div>
              </div>
            )}

            {pushError && (
              <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                {pushError}
              </div>
            )}

            {/* Reset feedback */}
            {resetTx && (
              <div className="mb-4 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-sm">
                ✓ Recipient reset on-chain.{" "}
                <a href={`https://explorer.solana.com/tx/${resetTx}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="underline opacity-70 hover:opacity-100">View tx ↗</a>
              </div>
            )}
            {resetError && (
              <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                Reset failed: {resetError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExecutePushAll}
                disabled={pushLoading}
                className="px-6 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-60 flex items-center gap-2"
                style={{ background: "#0ea5e9" }}
              >
                {pushLoading ? (
                  <><span className="animate-spin">⏳</span> Sending...</>
                ) : (
                  <>Send to all {unclaimedRecipients.length} remaining →</>
                )}
              </button>

              {failedIndices.length > 0 && (
                <button
                  onClick={handleRetryFailed}
                  disabled={pushLoading}
                  className="px-5 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-60 flex items-center gap-2 border"
                  style={{ color: "#f59e0b", borderColor: "#f59e0b40", background: "#f59e0b10" }}
                >
                  ↺ Retry {failedIndices.length} failed
                </button>
              )}
            </div>
          </div>
        )}

        {/* Claim */}
        {canClaim && !claimSuccess && (
          <div className="p-5 rounded-xl border" style={{ background: "#0d1117", borderColor: "#22c55e30" }}>
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span>✋</span> Claim your tokens
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              You are eligible to claim{" "}
              <strong className="text-white">
                {formatAmount(myRecipient!.amount, airdrop.mint)} {getTokenSymbol(airdrop.mint)}
              </strong>
              . You will pay the ATA creation fee (~0.002 SOL).
            </p>

            {claimError && (
              <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                {claimError}
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={claimLoading}
              className="px-6 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-60 flex items-center gap-2"
              style={{ background: "#22c55e" }}
            >
              {claimLoading ? (
                <><span className="animate-spin">⏳</span> Claiming...</>
              ) : (
                <>Claim {formatAmount(myRecipient!.amount, airdrop.mint)} {getTokenSymbol(airdrop.mint)} →</>
              )}
            </button>
          </div>
        )}

        {claimSuccess && (
          <div className="p-5 rounded-xl border text-center"
            style={{ background: "#0d1117", borderColor: "#22c55e40" }}>
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-green-400 font-semibold">Claimed successfully!</div>
          </div>
        )}

        {/* My recipient status */}
        {myRecipient && airdrop.mode === "claim" && myRecipient.claimed && (
          <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 text-sky-400 text-sm flex items-center gap-2">
            ✓ You have already claimed {formatAmount(myRecipient.amount, airdrop.mint)} {getTokenSymbol(airdrop.mint)}.
          </div>
        )}

        {/* Recipients table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ background: "#0d1117", borderColor: "#1e293b" }}>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Recipients — {totalCount}
            </span>
            <span className="text-xs text-slate-600">
              {claimedCount} {airdrop.mode === "claim" ? "claimed" : "paid"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#1e293b" }}>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">#</th>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">Wallet</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">Amount</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {airdrop.recipients.map((r, i) => {
                  const isMe = r.wallet === myWallet;
                  return (
                    <tr
                      key={i}
                      className="border-b last:border-0 transition-colors"
                      style={{
                        borderColor: "#1e293b",
                        background: isMe ? "#0ea5e908" : "transparent",
                      }}
                    >
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://explorer.solana.com/address/${r.wallet}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs hover:text-sky-400 transition-colors"
                            style={{ color: isMe ? "#0ea5e9" : "#94a3b8" }}
                          >
                            {short(r.wallet)}
                          </a>
                          {isMe && (
                            <span className="text-xs px-1.5 py-0.5 rounded text-sky-400 border border-sky-400/20">you</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 font-mono text-sm">
                        {formatAmount(r.amount, airdrop.mint)} {getTokenSymbol(airdrop.mint)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.claimed ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border"
                              style={{ background: "#22c55e10", borderColor: "#22c55e40", color: "#22c55e" }}>
                              ✓ {airdrop.mode === "claim" ? "claimed" : "paid"}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full border"
                              style={{ background: "#fbbf2410", borderColor: "#fbbf2440", color: "#fbbf24" }}>
                              pending
                            </span>
                          )}
                          {/* Reset button: visible to creator/admin for any recipient */}
                          {(myWallet === airdrop.creator) && airdrop.status === "active" && (
                            <button
                              onClick={() => handleResetRecipient(i)}
                              disabled={resetLoading === i}
                              title={r.claimed ? "Reset claimed status (for retry)" : "Mark as unclaimed"}
                              className="text-xs px-2 py-0.5 rounded border transition-all disabled:opacity-40"
                              style={{
                                color: "#94a3b8",
                                borderColor: "#334155",
                                background: "transparent",
                              }}
                            >
                              {resetLoading === i ? "…" : "↺"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Metadata */}
        <div className="p-4 rounded-xl border" style={{ background: "#0d1117", borderColor: "#1e293b" }}>
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Metadata</h3>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex gap-4">
              <span className="text-slate-600 w-32 flex-shrink-0">Address</span>
              <span className="text-slate-300 break-all">{airdrop.address}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 w-32 flex-shrink-0">Creator</span>
              <a
                href={`https://explorer.solana.com/address/${airdrop.creator}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-sky-400 break-all"
              >
                {airdrop.creator}
              </a>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 w-32 flex-shrink-0">Mint</span>
              <span className="text-slate-300 break-all">{airdrop.mint}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 w-32 flex-shrink-0">Created</span>
              <span className="text-slate-300">{new Date(airdrop.createdAt * 1000).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
