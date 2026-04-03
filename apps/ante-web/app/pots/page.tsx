"use client";

import Link from "next/link";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState, useCallback } from "react";
import { fetchAllPots, type OnChainPot } from "@/lib/program";
import { SUPPORTED_TOKENS } from "@/lib/constants";

function mintSymbol(mint: string) {
  return SUPPORTED_TOKENS.find(t => t.mint === mint)?.symbol ?? mint.slice(0, 6) + "…";
}

function statusBadge(status: OnChainPot["status"]) {
  if (status === "open") return <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Open</span>;
  if (status === "released") return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Released</span>;
  return <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Cancelled</span>;
}

type FilterType = "all" | "contribution" | "fundraise" | "mine";

export default function PotsPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const [pots, setPots] = useState<OnChainPot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const load = useCallback(async () => {
    if (!anchorWallet) return;
    setLoading(true); setError("");
    try {
      const data = await fetchAllPots(connection, anchorWallet);
      setPots(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [connection, anchorWallet]);

  useEffect(() => { if (anchorWallet) load(); }, [anchorWallet, load]);

  const displayed = pots.filter(p => {
    if (filter === "mine") {
      return p.creator === publicKey?.toBase58() ||
        p.contributors.some(c => c.wallet === publicKey?.toBase58());
    }
    if (filter === "contribution") return (p as any).kind !== 'fundraise';
    if (filter === "fundraise") return (p as any).kind === 'fundraise';
    return true;
  });

  return (
    <main className="min-h-screen bg-[#080c14] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
        <Link href="/" className="text-xl font-bold tracking-tight text-emerald-400">ante</Link>
        <div className="flex items-center gap-4">
          <Link href="/create" className="text-sm text-white/60 hover:text-white transition">+ New pot</Link>
          <WalletMultiButton className="!bg-emerald-600 !rounded-xl !text-sm" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pots</h1>
            <p className="text-white/40 mt-1">
              {loading ? "Loading from devnet…" : `${pots.length} pot${pots.length !== 1 ? "s" : ""} on-chain`}
            </p>
          </div>
          <button onClick={load} disabled={loading || !anchorWallet}
            className="text-sm text-white/40 hover:text-white disabled:opacity-30 transition">↻ Refresh</button>
        </div>

        {connected && (
          <div className="flex gap-2 flex-wrap">
            {(["all", "contribution", "fundraise", "mine"] as FilterType[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm transition ${
                  filter === f ? "bg-emerald-600 text-white" : "bg-white/5 text-white/50 hover:text-white"
                }`}>
                {f === "all" ? "All pots" : f === "contribution" ? "Contribution" : f === "fundraise" ? "Fundraise" : "My pots"}
              </button>
            ))}
          </div>
        )}

        {!connected && (
          <div className="text-center py-16 space-y-4">
            <p className="text-white/40">Connect wallet to browse pots</p>
            <WalletMultiButton className="!bg-emerald-600 !rounded-xl" />
          </div>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse h-28" />)}
          </div>
        )}

        {!loading && displayed.map(pot => {
          const isFundraise = (pot as any).kind === 'fundraise';
          const symbol = mintSymbol(pot.mint);
          const isCreator = pot.creator === publicKey?.toBase58();
          const isContributor = pot.contributors.some(c => c.wallet === publicKey?.toBase58());
          const myEntry = pot.contributors.find(c => c.wallet === publicKey?.toBase58());

          if (isFundraise) {
            const raised = Number(pot.totalDeposited) / 1e6;
            const goal = Number(pot.targetAmount) / 1e6;
            const progress = goal > 0 ? Math.min(1, raised / goal) : 0;
            return (
              <Link key={pot.address} href={`/pots/${pot.address}`}
                className="block bg-white/5 border border-white/10 hover:border-emerald-500/40 rounded-2xl p-6 transition group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-lg group-hover:text-emerald-300 transition">
                        {pot.name || "Unnamed Pot"}
                      </h2>
                      {statusBadge(pot.status)}
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">🎯 Fundraise</span>
                      {isCreator && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Creator</span>}
                    </div>
                    {pot.description && <p className="text-sm text-white/40 truncate">{pot.description}</p>}
                    <p className="text-xs text-white/30 font-mono">{pot.address.slice(0, 20)}…</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-white/40">{symbol} raised</p>
                    <p className="font-semibold text-lg">{raised.toFixed(2)}</p>
                    <p className="text-xs text-white/40">of {goal.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${progress * 100}%` }} />
                </div>
                <p className="text-xs text-white/30 mt-1">{pot.contributors.length} supporter{pot.contributors.length !== 1 ? 's' : ''} · {Math.round(progress * 100)}% funded</p>
              </Link>
            );
          }

          // Contribution pot
          const deposited = pot.contributors.filter(c => c.deposited).length;
          const total = pot.contributors.length;
          const amtPer = Number(pot.amountPerContributor) / 1e6;
          const progress = total > 0 ? deposited / total : 0;

          return (
            <Link key={pot.address} href={`/pots/${pot.address}`}
              className="block bg-white/5 border border-white/10 hover:border-emerald-500/40 rounded-2xl p-6 transition group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-lg group-hover:text-emerald-300 transition">
                      {pot.name || "Unnamed Pot"}
                    </h2>
                    {statusBadge(pot.status)}
                    {isCreator && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Creator</span>}
                    {isContributor && !isCreator && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        myEntry?.deposited ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"
                      }`}>
                        {myEntry?.deposited ? "✓ Deposited" : "Pending"}
                      </span>
                    )}
                  </div>
                  {pot.description && <p className="text-sm text-white/40 truncate">{pot.description}</p>}
                  <p className="text-xs text-white/30 font-mono">{pot.address.slice(0, 20)}…</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/40">{symbol} · {amtPer}/contributor</p>
                  <p className="font-semibold text-lg">{deposited}/{total}</p>
                  <p className="text-xs text-white/40">contributed</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${progress * 100}%` }} />
              </div>
            </Link>
          );
        })}

        {!loading && connected && displayed.length === 0 && (
          <div className="text-center py-24 text-white/30 space-y-3">
            <p className="text-lg">{filter === "mine" ? "You have no pots yet" : "No pots on-chain yet"}</p>
            <Link href="/create" className="text-emerald-400 hover:text-emerald-300 text-sm inline-block">
              Create the first one →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
