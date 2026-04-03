"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProgram, getProtocolConfigPDA, fetchMintInfo } from "@/lib/program";
import { KNOWN_TOKENS, BASIS_POINTS_DENOM } from "@/lib/constants";

const DEFAULT_DEATH_MSGS = [
  "{player} didn't see it coming.",
  "{player} ran out of luck.",
  "{player} was outplayed and eliminated.",
  "{player} couldn't keep up with the competition.",
  "{player} fell to a superior strategy.",
  "{player} made one too many mistakes.",
  "{player} met their match.",
  "{player} is out of the Gauntlet.",
];

export default function CreateGamePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();

  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [mintAddress, setMintAddress] = useState(KNOWN_TOKENS[1].mint); // default USDC
  const [mintInfo, setMintInfo] = useState<{ decimals: number } | null>({ decimals: 6 });
  const [mintLoading, setMintLoading] = useState(false);
  const [mintError, setMintError] = useState("");
  const [entryFeeDisplay, setEntryFeeDisplay] = useState("1");
  const [maxPlayers, setMaxPlayers] = useState("100");
  const [mutable, setMutable] = useState(false);
  const [autoPay, setAutoPay] = useState(true);
  const [deathMsgs, setDeathMsgs] = useState(DEFAULT_DEATH_MSGS.join("\n"));

  // Winner splits — start with top 3
  const [winnerRows, setWinnerRows] = useState([
    { pct: "50" },
    { pct: "25" },
    { pct: "20" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [txStep, setTxStep] = useState("");

  const totalWinnerPct = winnerRows.reduce((s, r) => s + parseFloat(r.pct || "0"), 0);
  const adminPct = 100 - totalWinnerPct;

  const handleMintChange = async (val: string) => {
    setMintAddress(val);
    setMintError("");
    setMintInfo(null);
    const known = KNOWN_TOKENS.find(t => t.mint === val);
    if (known) { setMintInfo({ decimals: known.decimals }); return; }
    if (val.length < 32) return;
    setMintLoading(true);
    try {
      const info = await fetchMintInfo(connection, val);
      if (info) setMintInfo(info);
      else setMintError("Not a valid SPL mint");
    } finally { setMintLoading(false); }
  };

  const tokenSymbol = KNOWN_TOKENS.find(t => t.mint === mintAddress)?.symbol ?? "tokens";

  const canCreate =
    name.trim().length > 0 &&
    mintInfo !== null &&
    parseFloat(entryFeeDisplay) > 0 &&
    winnerRows.length > 0 &&
    totalWinnerPct <= 100 &&
    winnerRows.every(r => parseFloat(r.pct || "0") > 0);

  const handleCreate = async () => {
    if (!wallet.publicKey || !mintInfo) return;
    setLoading(true);
    setError("");
    setTxStep("Fetching protocol state...");

    try {
      const program = getProgram(connection, wallet);
      const [configPDA] = getProtocolConfigPDA();
      const config = await (program.account as any).protocolConfig.fetch(configPDA);

      const decimals = mintInfo.decimals;
      const entryFeeRaw = new BN(Math.floor(parseFloat(entryFeeDisplay) * Math.pow(10, decimals)));

      const winnerSplits = winnerRows.map(r =>
        new BN(Math.round(parseFloat(r.pct) * 100)) // bps = pct * 100
      );

      const parsedDeaths = deathMsgs
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .slice(0, 20);

      const gameId = config.totalGames;
      const gameIdBytes = Buffer.alloc(8);
      gameIdBytes.writeBigUInt64LE(BigInt(gameId.toString()));

      const [gamePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), gameIdBytes],
        program.programId
      );
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), gameIdBytes],
        program.programId
      );

      setTxStep("Awaiting wallet approval...");
      const tx = await (program.methods as any).createGame({
        name: name.trim(),
        theme: theme.trim(),
        deathMessages: parsedDeaths,
        entryFee: entryFeeRaw,
        winnerSplits,
        maxPlayers: parseInt(maxPlayers) || 100,
        mutable,
        autoPay,
      })
        .accounts({
          protocolConfig: configPDA,
          game: gamePDA,
          mint: new PublicKey(mintAddress),
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      setTxStep("✅ Game created!");
      setTimeout(() => router.push(`/games/${gamePDA.toBase58()}`), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setTxStep("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#080c14" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <Link href="/" className="text-slate-400 hover:text-white text-sm transition">← Games</Link>
        <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px", fontSize: "13px", height: "34px" }} />
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-white mb-2">Create Game</h1>
        <p className="text-slate-400 text-sm mb-10">Set up a new Gauntlet. Once started, only immutable settings can't be changed.</p>

        {!wallet.connected ? (
          <div className="text-center py-16">
            <WalletMultiButton style={{ background: "#d97706", color: "#fff", borderRadius: "8px" }} />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Basic info */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Basic Info</h2>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Game name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spring Gauntlet 2026"
                  className="w-full px-4 py-3 rounded-xl border text-white outline-none focus:border-amber-500"
                  style={{ background: "#0e1420", borderColor: "#1e293b" }} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Theme / flavor text</label>
                <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="e.g. Post-apocalyptic wasteland rumble"
                  className="w-full px-4 py-3 rounded-xl border text-white outline-none focus:border-amber-500"
                  style={{ background: "#0e1420", borderColor: "#1e293b" }} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Max players</label>
                <input type="number" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} min="2" max="500"
                  className="w-full px-4 py-3 rounded-xl border text-white outline-none focus:border-amber-500"
                  style={{ background: "#0e1420", borderColor: "#1e293b" }} />
              </div>
            </section>

            {/* Token & fee */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Entry Token & Fee</h2>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Token (any SPL mint)</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {KNOWN_TOKENS.map(t => (
                    <button key={t.mint} onClick={() => handleMintChange(t.mint)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${mintAddress === t.mint ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"}`}>
                      {t.symbol}
                    </button>
                  ))}
                </div>
                <input value={mintAddress} onChange={e => handleMintChange(e.target.value)}
                  placeholder="Or paste any SPL token mint..."
                  className="w-full px-4 py-3 rounded-xl border text-white text-sm font-mono outline-none focus:border-amber-500"
                  style={{ background: "#0e1420", borderColor: "#1e293b" }} />
                {mintError && <p className="text-red-400 text-xs mt-1">{mintError}</p>}
                {mintInfo && <p className="text-emerald-400 text-xs mt-1">✓ {tokenSymbol} — {mintInfo.decimals} decimals</p>}
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Entry fee ({tokenSymbol})</label>
                <input type="number" value={entryFeeDisplay} onChange={e => setEntryFeeDisplay(e.target.value)} min="0" step="any"
                  className="w-full px-4 py-3 rounded-xl border text-white outline-none focus:border-amber-500"
                  style={{ background: "#0e1420", borderColor: "#1e293b" }} />
                <p className="text-xs text-slate-600 mt-1">1% protocol fee deducted on entry. Admin sets the entry price.</p>
              </div>
            </section>

            {/* Winner splits */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Winner Splits</h2>
              <p className="text-xs text-slate-500">Percentages of the prize pool. Remainder ({Math.max(0, adminPct).toFixed(1)}%) goes to you as admin profit.</p>
              {winnerRows.map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-16 shrink-0">
                    {i === 0 ? "🥇 #1" : i === 1 ? "🥈 #2" : i === 2 ? "🥉 #3" : `  #${i+1}`}
                  </span>
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={row.pct}
                    onChange={e => {
                      const updated = [...winnerRows];
                      updated[i] = { pct: e.target.value };
                      setWinnerRows(updated);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border text-white outline-none focus:border-amber-500"
                    style={{ background: "#0e1420", borderColor: "#1e293b" }}
                  />
                  <span className="text-slate-500 text-sm">%</span>
                  <button onClick={() => setWinnerRows(winnerRows.filter((_, j) => j !== i))}
                    className="text-slate-600 hover:text-red-400 transition text-lg">×</button>
                </div>
              ))}
              {winnerRows.length < 10 && (
                <button
                  onClick={() => setWinnerRows([...winnerRows, { pct: "5" }])}
                  className="text-sm text-amber-400 hover:text-amber-300 transition"
                >
                  + Add winner
                </button>
              )}
              {totalWinnerPct > 100 && (
                <p className="text-red-400 text-xs">⚠️ Total exceeds 100% ({totalWinnerPct.toFixed(1)}%)</p>
              )}
            </section>

            {/* Settings */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Settings</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "mutable", label: "🔓 Mutable", desc: "Admin can stop game early", value: mutable, set: setMutable },
                  { key: "autopay", label: "⚡ Auto-pay", desc: "Winners paid automatically", value: autoPay, set: setAutoPay },
                ].map(({ key, label, desc, value, set }) => (
                  <button key={key} onClick={() => set(!value)}
                    className="p-4 rounded-xl border text-left transition"
                    style={{
                      background: value ? "#d9770610" : "#0e1420",
                      borderColor: value ? "#d97706" : "#1e293b",
                    }}>
                    <div className="text-sm font-semibold" style={{ color: value ? "#d97706" : "#e2e8f0" }}>{label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
              {mutable && (
                <div className="text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  ⚠️ Mutable games: you can drain funds at any time. Only super admin can toggle this after creation.
                </div>
              )}
            </section>

            {/* Death messages */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Death Messages</h2>
              <p className="text-xs text-slate-500">One per line. Use <code className="text-amber-400">{"{{player}}"}</code> for player name. Max 20. Picked randomly on elimination.</p>
              <textarea
                value={deathMsgs}
                onChange={e => setDeathMsgs(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 rounded-xl border text-sm font-mono text-slate-300 resize-none outline-none focus:border-amber-500"
                style={{ background: "#0e1420", borderColor: "#1e293b", lineHeight: 1.6 }}
              />
              <p className="text-xs text-slate-600">
                {deathMsgs.split("\n").filter(l => l.trim()).length} / 20 messages
              </p>
            </section>

            {error && (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">{error}</div>
            )}
            {txStep && (
              <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400 text-sm flex items-center gap-2">
                <span className="animate-spin">⏳</span> {txStep}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={loading || !canCreate}
              className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all disabled:opacity-40"
              style={{ background: "#d97706" }}
            >
              {loading ? "⏳ Creating..." : "⚔️ Create Gauntlet"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
