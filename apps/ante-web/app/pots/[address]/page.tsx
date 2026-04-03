"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect, useCallback } from "react";
import {
  fetchPot, fetchVaultBalance, contribute as doContribute,
  release as doRelease, cancelPot, refundContributor, fundraiseContribute,
  type OnChainPot, type ContributionMode,
} from "@/lib/program";
import { SUPPORTED_TOKENS } from "@/lib/constants";

function short(a: string) { return a.slice(0, 6) + "…" + a.slice(-4); }
function mintInfo(mint: string) {
  return SUPPORTED_TOKENS.find(t => t.mint === mint) ?? { symbol: "SPL", decimals: 6, name: "Token" };
}

function TxLink({ tx }: { tx: string }) {
  return (
    <a href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
      target="_blank" rel="noopener noreferrer"
      className="underline opacity-60 hover:opacity-100 ml-1">↗ tx</a>
  );
}

function contributionModeLabel(mode: ContributionMode): string {
  if (mode === "equalFixed") return "Equal";
  if (mode === "customFixed") return "Custom";
  return "% of target";
}

function getRequiredAmount(
  pot: OnChainPot,
  contributorIdx: number,
  decimals: number
): number {
  const c = pot.contributors[contributorIdx];
  if (pot.contributionMode === "equalFixed") {
    return Number(pot.amountPerContributor) / Math.pow(10, decimals);
  }
  if (pot.contributionMode === "customFixed") {
    return Number(c.requiredAmount) / Math.pow(10, decimals);
  }
  // percentOfTarget: requiredAmount is bps
  const targetRaw = Number(pot.targetAmount);
  const bps = Number(c.requiredAmount);
  return (targetRaw * bps / 10_000) / Math.pow(10, decimals);
}

export default function PotDetail() {
  const { address } = useParams<{ address: string }>();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const [pot, setPot] = useState<OnChainPot | null>(null);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [fundraiseAmount, setFundraiseAmount] = useState('');

  const [actionLoading, setActionLoading] = useState("");
  const [actionTx, setActionTx] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!anchorWallet || !address) return;
    setLoading(true); setDataError("");
    try {
      const p = await fetchPot(connection, anchorWallet, address);
      if (!p) { setDataError("Pot not found on-chain."); return; }
      setPot(p);
      const bal = await fetchVaultBalance(connection, address, p.mint);
      setVaultBalance(bal);
    } catch (e: any) { setDataError(e.message); }
    finally { setLoading(false); }
  }, [connection, anchorWallet, address]);

  useEffect(() => { if (anchorWallet) loadData(); }, [anchorWallet, loadData]);

  async function run(key: string, fn: () => Promise<string>) {
    setActionLoading(key);
    setActionError(p => ({ ...p, [key]: "" }));
    setActionTx(p => ({ ...p, [key]: "" }));
    try {
      const tx = await fn();
      setActionTx(p => ({ ...p, [key]: tx }));
      await loadData();
    } catch (e: any) {
      setActionError(p => ({ ...p, [key]: e.message ?? "Error" }));
    } finally { setActionLoading(""); }
  }

  const token = pot ? mintInfo(pot.mint) : null;
  const isFundraise = pot?.kind === 'fundraise';
  const isCreator = pot?.creator === publicKey?.toBase58();
  const myContributorIdx = pot?.contributors.findIndex(c => c.wallet === publicKey?.toBase58()) ?? -1;
  const myEntry = myContributorIdx >= 0 ? pot?.contributors[myContributorIdx] : undefined;
  const isContributor = myContributorIdx >= 0;

  const myRequiredAmount = pot && isContributor && !isFundraise
    ? getRequiredAmount(pot, myContributorIdx, token?.decimals ?? 6)
    : 0;

  const depositedCount = pot?.contributors.filter(c => c.deposited).length ?? 0;
  const totalCount = pot?.contributors.length ?? 0;

  const thresholdMet = pot && !isFundraise ? (() => {
    if (!pot.threshold) return false;
    if ("allIn" in pot.threshold) return depositedCount === totalCount;
    if ("partial" in pot.threshold) return depositedCount >= (pot.threshold as any).partial.minCount;
    return false;
  })() : false;

  const canRelease =
    pot?.status === "open" && (
      isFundraise
        ? isCreator
        : thresholdMet && (pot.releaseMode === "auto" || isCreator)
    );

  if (!connected) return (
    <main className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center gap-4">
      <p className="text-white/50">Connect wallet to view this pot</p>
      <WalletMultiButton className="!bg-emerald-600 !rounded-xl" />
    </main>
  );

  if (loading) return (
    <main className="min-h-screen bg-[#080c14] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
        <Link href="/" className="text-xl font-bold text-emerald-400">ante</Link>
        <WalletMultiButton className="!bg-emerald-600 !rounded-xl !text-sm" />
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-4">
        {[1,2,3].map(i => <div key={i} className="bg-white/5 rounded-2xl animate-pulse h-20" />)}
      </div>
    </main>
  );

  if (dataError || !pot) return (
    <main className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{dataError || "Pot not found"}</p>
      <Link href="/pots" className="text-emerald-400 text-sm">← Back to pots</Link>
    </main>
  );

  const statusColor = pot.status === "open" ? "text-emerald-400" : pot.status === "released" ? "text-blue-400" : "text-red-400";

  return (
    <main className="min-h-screen bg-[#080c14] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
        <Link href="/" className="text-xl font-bold text-emerald-400">ante</Link>
        <WalletMultiButton className="!bg-emerald-600 !rounded-xl !text-sm" />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">

        {/* Header */}
        <div>
          <Link href="/pots" className="text-white/40 hover:text-white text-sm transition">← Pots</Link>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{pot.name || "Unnamed Pot"}</h1>
              {pot.description && <p className="text-white/50 mt-1">{pot.description}</p>}
              <p className="text-xs text-white/30 font-mono mt-2">{address}</p>
            </div>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <span className={`text-sm font-semibold ${statusColor} bg-white/5 px-3 py-1 rounded-full`}>
                {pot.status.charAt(0).toUpperCase() + pot.status.slice(1)}
              </span>
              {isFundraise ? (
                <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-1 rounded-full">🎯 Fundraise</span>
              ) : (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">
                  {contributionModeLabel(pot.contributionMode)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Fundraise progress panel */}
        {isFundraise && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm text-white/40">Raised</p>
                <p className="text-3xl font-bold">{(Number(pot.totalDeposited) / Math.pow(10, token?.decimals ?? 6)).toFixed(4)} {token?.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/40">Goal</p>
                <p className="text-xl font-semibold">{(Number(pot.targetAmount) / Math.pow(10, token?.decimals ?? 6)).toFixed(4)} {token?.symbol}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (Number(pot.totalDeposited) / Number(pot.targetAmount)) * 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>{Math.min(100, Math.round((Number(pot.totalDeposited) / Number(pot.targetAmount)) * 100))}% funded</span>
              <span>{pot.contributors.length} supporter{pot.contributors.length !== 1 ? 's' : ''}</span>
            </div>
            {pot.fundraiseMode === 'ruggable' && (
              <div className="text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                ⚡ Ruggable — creator can withdraw funds at any time
              </div>
            )}
          </div>
        )}

        {/* Stats (contribution pots only) */}
        {!isFundraise && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: pot.contributionMode === "equalFixed" ? "Per contributor" : "Contribution mode",
                  value: pot.contributionMode === "equalFixed"
                    ? `${(Number(pot.amountPerContributor) / Math.pow(10, token?.decimals ?? 6))} ${token?.symbol}`
                    : contributionModeLabel(pot.contributionMode),
                },
                { label: "In vault", value: `${vaultBalance.toFixed(4)} ${token?.symbol}`, hi: vaultBalance > 0 },
                { label: "Progress", value: `${depositedCount} / ${totalCount}` },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl p-4 ${(s as any).hi ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10"}`}>
                  <p className="text-xs text-white/40">{s.label}</p>
                  <p className="text-lg font-semibold mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/40 mb-1.5">
                <span>{depositedCount} deposited</span>
                <span>{totalCount - depositedCount} remaining</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (depositedCount / totalCount) * 100 : 0}%` }} />
              </div>
              {thresholdMet && pot.status === "open" && (
                <p className="text-xs text-emerald-400 mt-1.5">✓ Threshold met</p>
              )}
            </div>
          </>
        )}

        {/* Fundraise contribute input */}
        {isFundraise && pot.status === 'open' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
            <p className="font-semibold text-emerald-300">Support this fundraise</p>
            <div className="flex gap-3">
              <input type="number" min="0.01" step="any"
                value={fundraiseAmount} onChange={e => setFundraiseAmount(e.target.value)}
                placeholder={`Amount (${token?.symbol})`}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500" />
              <button
                onClick={() => run('fundraise', async () => {
                  const cfg = await (async () => {
                    const { getProgram, getProtocolConfigPDA } = await import('@/lib/program');
                    const program = getProgram(connection, anchorWallet!);
                    const [pda] = getProtocolConfigPDA();
                    const a = await (program.account as any).protocolConfig.fetch(pda);
                    return { treasury: a.treasury.toBase58() };
                  })();
                  const { tx } = await fundraiseContribute(connection, anchorWallet!, publicKey!, address, pot.mint, Number(fundraiseAmount), token!.decimals, cfg.treasury, pot.recipient);
                  return tx;
                })}
                disabled={!!actionLoading || !fundraiseAmount || Number(fundraiseAmount) <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-xl transition">
                {actionLoading === 'fundraise' ? '…' : 'Contribute →'}
              </button>
            </div>
            <p className="text-xs text-white/30">1% protocol fee applies</p>
          </div>
        )}

        {/* My contribution banner (contribution pots) */}
        {!isFundraise && isContributor && pot.status === "open" && !myEntry?.deposited && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-amber-300 font-semibold">Your ante is due</p>
              <p className="text-2xl font-bold mt-1">{myRequiredAmount.toFixed(4)} {token?.symbol}</p>
              {pot.contributionMode === "percentOfTarget" && (
                <p className="text-xs text-white/40 mt-0.5">
                  {Number(pot.contributors[myContributorIdx].requiredAmount) / 100}% of{" "}
                  {(Number(pot.targetAmount) / Math.pow(10, token?.decimals ?? 6)).toFixed(2)} {token?.symbol} target
                </p>
              )}
              <p className="text-xs text-white/40 mt-0.5">1% protocol fee applies</p>
            </div>
            <button
              onClick={() => run("contribute", async () => {
                const cfg = await (async () => {
                  const { getProgram, getProtocolConfigPDA } = await import("@/lib/program");
                  const program = getProgram(connection, anchorWallet!);
                  const [pda] = getProtocolConfigPDA();
                  const a = await (program.account as any).protocolConfig.fetch(pda);
                  return { treasury: a.treasury.toBase58() };
                })();
                const { tx } = await doContribute(connection, anchorWallet!, publicKey!, address, pot.mint, myRequiredAmount, token!.decimals, cfg.treasury);
                return tx;
              })}
              disabled={!!actionLoading}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold px-6 py-3 rounded-xl transition shrink-0">
              {actionLoading === "contribute" ? "…" : "Ante up ♠"}
            </button>
          </div>
        )}

        {!isFundraise && isContributor && myEntry?.deposited && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400">
            ✓ You've deposited your share ({Number(myEntry.amount) / Math.pow(10, token?.decimals ?? 6)} {token?.symbol})
          </div>
        )}

        {/* Release banner */}
        {canRelease && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-blue-300 font-semibold">
                {isFundraise ? 'Release fundraise funds' : 'Ready to release'}
              </p>
              <p className="text-2xl font-bold mt-1">{vaultBalance.toFixed(4)} {token?.symbol}</p>
              <p className="text-xs text-white/40 mt-0.5">→ {short(pot.recipient)}</p>
            </div>
            <button
              onClick={() => run("release", async () => {
                const { tx } = await doRelease(connection, anchorWallet!, publicKey!, address, pot.mint, pot.recipient);
                return tx;
              })}
              disabled={!!actionLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition shrink-0">
              {actionLoading === "release" ? "…" : "Release funds →"}
            </button>
          </div>
        )}

        {/* Action feedback */}
        {Object.entries(actionTx).map(([key, tx]) => tx ? (
          <div key={key} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400">
            ✓ {key.charAt(0).toUpperCase() + key.slice(1)} successful <TxLink tx={tx} />
          </div>
        ) : null)}
        {Object.entries(actionError).map(([key, err]) => err ? (
          <div key={key} className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{err}</div>
        ) : null)}

        {/* Contributors / Supporters table */}
        <div>
          <h2 className="font-semibold mb-3">
            {isFundraise ? 'Supporters' : 'Contributors'}{' '}
            <span className="text-white/30 font-normal">({totalCount})</span>
          </h2>
          <div className="space-y-2">
            {pot.contributors.map((c, i) => {
              const isMe = c.wallet === publicKey?.toBase58();
              const reqAmt = !isFundraise ? getRequiredAmount(pot, i, token?.decimals ?? 6) : 0;
              return (
                <div key={i} className={`border rounded-xl px-4 py-3 flex items-center justify-between ${
                  isMe ? "bg-amber-500/5 border-amber-500/20" : "bg-white/5 border-white/10"
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{short(c.wallet)}</span>
                      {isMe && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">You</span>}
                    </div>
                    {/* Show required amount (contribution pots only) */}
                    {!isFundraise && pot.contributionMode !== "equalFixed" && (
                      <p className="text-xs text-white/40 mt-0.5">
                        Required: {reqAmt.toFixed(4)} {token?.symbol}
                        {pot.contributionMode === "percentOfTarget" && (
                          <span className="ml-1">({Number(c.requiredAmount) / 100}%)</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {c.deposited ? (
                      <span className="text-xs text-emerald-400">✓ {(Number(c.amount) / Math.pow(10, token?.decimals ?? 6)).toFixed(4)} {token?.symbol}</span>
                    ) : (
                      <span className="text-xs text-white/30">Pending</span>
                    )}
                    {/* Refund button if cancelled and deposited */}
                    {pot.status === "cancelled" && c.deposited && isMe && (
                      <button
                        onClick={() => run(`refund-${c.wallet}`, async () => {
                          const { tx } = await refundContributor(connection, anchorWallet!, publicKey!, address, pot.mint);
                          return tx;
                        })}
                        disabled={!!actionLoading}
                        className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition">
                        {actionLoading === `refund-${c.wallet}` ? "…" : "Claim refund"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Meta + creator actions */}
        <div className="border-t border-white/5 pt-6 space-y-4">
          <div className="text-xs text-white/30 space-y-1">
            <p>Creator: <span className="font-mono">{short(pot.creator)}</span></p>
            <p>Recipient: <span className="font-mono">{short(pot.recipient)}</span></p>
            {isFundraise ? (
              <p>Type: Fundraise · Mode: {pot.fundraiseMode === 'ruggable' ? '⚡ Ruggable' : '🎯 Fixed Limit'}</p>
            ) : (
              <>
                <p>Contribution mode: <span className="capitalize">{contributionModeLabel(pot.contributionMode)}</span></p>
                <p>Release: <span className="capitalize">{pot.releaseMode}</span> · Threshold: {"allIn" in pot.threshold ? "All in" : `${(pot.threshold as any).partial.minCount} of ${totalCount}`}</p>
              </>
            )}
            <p>Created: {new Date(pot.createdAt * 1000).toLocaleDateString()}</p>
          </div>

          {isCreator && pot.status === "open" && (
            <div>
              <button
                onClick={() => run("cancel", async () => {
                  const { tx } = await cancelPot(connection, anchorWallet!, publicKey!, address);
                  return tx;
                })}
                disabled={!!actionLoading}
                className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 px-4 py-2 rounded-lg transition">
                {actionLoading === "cancel" ? "Cancelling…" : "Cancel pot & refund contributors"}
              </button>
              <p className="text-xs text-white/20 mt-1">Each contributor will need to claim their refund after cancellation.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
