"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { fetchAllGames, OnChainGame, getProgram, getProtocolConfigPDA } from "@/lib/program";
import { SUPER_ADMIN } from "@/lib/constants";

export default function SuperAdminPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [games, setGames] = useState<OnChainGame[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = wallet.publicKey?.toBase58() === SUPER_ADMIN;

  useEffect(() => {
    if (!wallet.connected || !isSuperAdmin) { setLoading(false); return; }
    const program = getProgram(connection, wallet);
    const [configPDA] = getProtocolConfigPDA();
    Promise.all([
      fetchAllGames(connection, wallet),
      (program.account as any).protocolConfig.fetch(configPDA),
    ]).then(([g, c]) => {
      setGames(g);
      setConfig(c);
    }).finally(() => setLoading(false));
  }, [wallet.connected, isSuperAdmin, connection]);

  if (!wallet.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
        <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px" }} />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
        <div className="text-center">
          <p className="text-red-400 mb-4">🚫 Super admin access only</p>
          <Link href="/" className="text-amber-400 hover:underline">← Back to games</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#080c14" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <Link href="/" className="text-slate-400 hover:text-white text-sm">← Games</Link>
        <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px", fontSize: "13px", height: "34px" }} />
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-white">Super Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Global protocol controls. With great power comes great responsibility.</p>
        </div>

        {config && (
          <div className="p-5 rounded-2xl border border-amber-600/30" style={{ background: "#0e1420" }}>
            <h3 className="text-sm font-semibold text-amber-400 mb-3">Protocol Config</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Super admin</span>
                <span className="font-mono text-slate-300 text-xs">{config.superAdmin?.toBase58()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Treasury</span>
                <span className="font-mono text-slate-300 text-xs">{config.treasury?.toBase58()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Protocol fee</span>
                <span className="text-white">{config.protocolFeeBps?.toString()} bps ({Number(config.protocolFeeBps) / 100}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total games</span>
                <span className="text-white">{config.totalGames?.toString()}</span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
          <div className="px-4 py-3 border-b" style={{ background: "#0e1420", borderColor: "#1e293b" }}>
            <h3 className="font-semibold text-white">All Games ({games.length})</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : games.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No games yet.</div>
          ) : (
            <div className="divide-y divide-slate-900">
              {games.map(g => (
                <div key={g.address} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-semibold">{g.name}</p>
                    <p className="text-slate-500 text-xs font-mono">{g.address.slice(0, 12)}…</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{g.status} · {g.playerCount} players</span>
                    <Link
                      href={`/admin/games/${g.address}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-600/40 text-amber-400 hover:bg-amber-500/10 transition"
                    >
                      Manage →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
