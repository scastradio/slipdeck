"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { createPot, type ContributionMode, type ContributorParam } from "@/lib/program";
import { SUPPORTED_TOKENS, MAX_CONTRIBUTORS } from "@/lib/constants";

const RELEASE_MODES = [
  { value: "auto", label: "Auto", desc: "Releases automatically once threshold is met" },
  { value: "manual", label: "Manual", desc: "You approve the release when you're ready" },
];

const CONTRIBUTION_MODES: { value: ContributionMode; label: string; desc: string }[] = [
  { value: "equalFixed", label: "Equal", desc: "Everyone owes the same amount" },
  { value: "customFixed", label: "Custom", desc: "Each contributor has a different amount" },
  { value: "percentOfTarget", label: "% of target", desc: "Each contributor owes a % of a total target" },
];

interface ContributorEntry {
  wallet: string;
  amount: string;
}

export default function CreatePage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const [potKind, setPotKind] = useState<'contribution' | 'fundraise'>('contribution');
  const [fundraiseMode, setFundraiseMode] = useState<'fixedLimit' | 'ruggable'>('fixedLimit');

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selectedToken, setSelectedToken] = useState(SUPPORTED_TOKENS[0]);
  const [amountPerContributor, setAmountPerContributor] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [contributionMode, setContributionMode] = useState<ContributionMode>("equalFixed");
  const [contributors, setContributors] = useState<ContributorEntry[]>([{ wallet: "", amount: "" }]);
  const [releaseMode, setReleaseMode] = useState<"auto" | "manual">("auto");
  const [thresholdType, setThresholdType] = useState<"allIn" | "partial">("allIn");
  const [minCount, setMinCount] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const addContributor = () => {
    if (contributors.length < MAX_CONTRIBUTORS) setContributors([...contributors, { wallet: "", amount: "" }]);
  };
  const removeContributor = (i: number) => setContributors(contributors.filter((_, idx) => idx !== i));
  const updateContributor = (i: number, field: keyof ContributorEntry, val: string) => {
    const updated = [...contributors];
    updated[i] = { ...updated[i], [field]: val };
    setContributors(updated);
  };

  const handleCreate = useCallback(async () => {
    if (!connected || !publicKey || !anchorWallet) return;
    setError(""); setSuccess(""); setLoading(true);

    try {
      if (!name.trim()) throw new Error("Pot name is required");
      if (!recipient.trim()) throw new Error("Recipient wallet is required");

      let recipientPk: PublicKey;
      try { recipientPk = new PublicKey(recipient.trim()); } catch { throw new Error("Invalid recipient wallet address"); }

      let validContributors: ContributorParam[] = [];

      if (potKind === 'contribution') {
        // Validate contribution mode specific fields
        if (contributionMode === "equalFixed") {
          if (!amountPerContributor || Number(amountPerContributor) <= 0)
            throw new Error("Amount per contributor required");
        }
        if (contributionMode === "percentOfTarget") {
          if (!targetAmount || Number(targetAmount) <= 0)
            throw new Error("Target amount is required for % of target mode");
        }

        for (const c of contributors) {
          if (!c.wallet.trim()) throw new Error("All contributor wallet addresses must be filled in");
          let wallet: PublicKey;
          try { wallet = new PublicKey(c.wallet.trim()); } catch { throw new Error(`Invalid address: ${c.wallet}`); }

          let requiredAmount = 0;
          if (contributionMode === "customFixed") {
            const amt = Number(c.amount);
            if (!amt || amt <= 0) throw new Error("All custom amounts must be > 0");
            requiredAmount = Math.round(amt * Math.pow(10, selectedToken.decimals));
          } else if (contributionMode === "percentOfTarget") {
            const pct = Number(c.amount);
            if (!pct || pct <= 0 || pct > 100) throw new Error("All percentages must be between 0 and 100");
            requiredAmount = Math.round(pct * 100);
          }
          validContributors.push({ wallet, requiredAmount });
        }
      } else {
        // Fundraise: just need target amount
        if (!targetAmount || Number(targetAmount) <= 0)
          throw new Error("Target amount is required for fundraise");
      }

      const threshold =
        thresholdType === "allIn"
          ? { type: "allIn" as const }
          : { type: "partial" as const, minCount };

      const seed = crypto.getRandomValues(new Uint8Array(8));

      const { tx, potAddress } = await createPot(connection, anchorWallet, publicKey, {
        seed,
        name: name.trim(),
        description: description.trim(),
        mint: new PublicKey(selectedToken.mint),
        recipient: recipientPk,
        amountPerContributor: potKind === 'contribution' && contributionMode === "equalFixed" ? Number(amountPerContributor) : 0,
        targetAmount: Number(targetAmount) || 0,
        decimals: selectedToken.decimals,
        contributionMode: potKind === 'contribution' ? contributionMode : 'equalFixed',
        contributors: validContributors,
        releaseMode,
        threshold,
        kind: potKind,
        fundraiseMode,
      });

      setSuccess(`Pot created! Share this link: /pots/${potAddress}\nTx: ${tx}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, anchorWallet, connection, name, description, recipient, selectedToken, amountPerContributor, targetAmount, contributionMode, contributors, releaseMode, thresholdType, minCount, potKind, fundraiseMode]);

  if (!connected) {
    return (
      <main className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-white/50">Connect your wallet to create a pot</p>
        <WalletMultiButton className="!bg-emerald-600 !rounded-xl" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080c14] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
        <Link href="/" className="text-xl font-bold tracking-tight text-emerald-400">ante</Link>
        <WalletMultiButton className="!bg-emerald-600 !rounded-xl !text-sm" />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <Link href="/" className="text-white/40 hover:text-white text-sm transition">← Home</Link>
          <h1 className="text-3xl font-bold mt-3">Create a pot</h1>
          <p className="text-white/50 mt-1">Set the terms. Invite contributors. Funds release when the pot's right.</p>
        </div>

        {/* Pot type */}
        <div>
          <label className="text-sm text-white/60 block mb-2">Pot type</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'contribution' as const, label: '♠ Contribution Pot', desc: 'Fixed contributors, each owes a share' },
              { value: 'fundraise' as const, label: '🎯 Fundraise', desc: 'Anyone can contribute toward a goal' },
            ].map(k => (
              <button key={k.value} onClick={() => setPotKind(k.value)}
                className={`p-4 rounded-xl border text-left transition ${
                  potKind === k.value
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}>
                <p className="font-semibold text-sm">{k.label}</p>
                <p className="text-xs mt-1 opacity-70">{k.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Fundraise mode selector */}
        {potKind === 'fundraise' && (
          <div>
            <label className="text-sm text-white/60 block mb-2">Fundraise type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'fixedLimit' as const, label: '🎯 Fixed Limit', desc: 'Auto-releases when target is reached' },
                { value: 'ruggable' as const, label: '⚡ Ruggable', desc: 'Creator can release or cancel at any time' },
              ].map(m => (
                <button key={m.value} onClick={() => setFundraiseMode(m.value)}
                  className={`p-4 rounded-xl border text-left transition ${
                    fundraiseMode === m.value
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                  }`}>
                  <p className="font-semibold text-sm">{m.label}</p>
                  <p className="text-xs mt-1 opacity-70">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name + description */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60 block mb-1.5">Pot name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Team dinner, Group gift, Shared subscription"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-sm text-white/60 block mb-1.5">Description <span className="text-white/30">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What's this pot for?"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 resize-none" />
          </div>
        </div>

        {/* Recipient */}
        <div>
          <label className="text-sm text-white/60 block mb-1.5">Recipient wallet</label>
          <input value={recipient} onChange={e => setRecipient(e.target.value)}
            placeholder="Solana wallet address"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 font-mono text-sm" />
          <button onClick={() => setRecipient(publicKey?.toBase58() ?? "")}
            className="text-xs text-emerald-400 hover:text-emerald-300 mt-1.5 transition">
            Use my wallet
          </button>
        </div>

        {/* Token */}
        <div>
          <label className="text-sm text-white/60 block mb-1.5">Token</label>
          <select value={selectedToken.symbol}
            onChange={e => setSelectedToken(SUPPORTED_TOKENS.find(t => t.symbol === e.target.value)!)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500">
            {SUPPORTED_TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
          </select>
        </div>

        {/* Target amount — for fundraise always, for contribution only percentOfTarget */}
        {(potKind === 'fundraise' || contributionMode === 'percentOfTarget') && (
          <div>
            <label className="text-sm text-white/60 block mb-1.5">
              {potKind === 'fundraise' ? 'Fundraise goal' : 'Total target amount'} ({selectedToken.symbol})
              {potKind === 'fundraise' && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input type="number" min="0" step="any" value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              placeholder={potKind === 'fundraise' ? "e.g. 500 (required)" : "e.g. 1000"}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500" />
          </div>
        )}

        {/* Contribution-specific fields */}
        {potKind === 'contribution' && (
          <>
            {/* Contribution mode */}
            <div>
              <label className="text-sm text-white/60 block mb-2">Contribution mode</label>
              <div className="grid grid-cols-3 gap-3">
                {CONTRIBUTION_MODES.map(m => (
                  <button key={m.value} onClick={() => setContributionMode(m.value)}
                    className={`p-3 rounded-xl border text-left transition ${
                      contributionMode === m.value
                        ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                        : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                    }`}>
                    <p className="font-semibold text-sm">{m.label}</p>
                    <p className="text-xs mt-1 opacity-70">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount field (equalFixed only) */}
            {contributionMode === "equalFixed" && (
              <div>
                <label className="text-sm text-white/60 block mb-1.5">Amount per contributor ({selectedToken.symbol})</label>
                <input type="number" min="0" step="any" value={amountPerContributor}
                  onChange={e => setAmountPerContributor(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500" />
              </div>
            )}

            {/* Contributors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white/60">Contributors <span className="text-white/30">({contributors.length}/{MAX_CONTRIBUTORS})</span></label>
                <button onClick={addContributor} disabled={contributors.length >= MAX_CONTRIBUTORS}
                  className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-30 transition">
                  + Add wallet
                </button>
              </div>
              <div className="space-y-2">
                {contributors.map((c, i) => (
                  <div key={i} className={`flex gap-2 ${contributionMode !== "equalFixed" ? "flex-col" : ""}`}>
                    <div className="flex gap-2 w-full">
                      <input value={c.wallet} onChange={e => updateContributor(i, "wallet", e.target.value)}
                        placeholder={`Wallet address ${i + 1}`}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 font-mono text-sm" />
                      {contributors.length > 1 && (
                        <button onClick={() => removeContributor(i)}
                          className="text-white/30 hover:text-red-400 transition px-2">✕</button>
                      )}
                    </div>
                    {contributionMode === "customFixed" && (
                      <div className="flex gap-2 items-center pl-0">
                        <input type="number" min="0" step="any"
                          value={c.amount} onChange={e => updateContributor(i, "amount", e.target.value)}
                          placeholder={`Amount (${selectedToken.symbol})`}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 text-sm" />
                        <span className="text-white/30 text-sm">{selectedToken.symbol}</span>
                      </div>
                    )}
                    {contributionMode === "percentOfTarget" && (
                      <div className="flex gap-2 items-center pl-0">
                        <input type="number" min="0" max="100" step="any"
                          value={c.amount} onChange={e => updateContributor(i, "amount", e.target.value)}
                          placeholder="% of target"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 text-sm" />
                        <span className="text-white/30 text-sm">%</span>
                        {targetAmount && c.amount && (
                          <span className="text-white/40 text-xs whitespace-nowrap">
                            = {(Number(targetAmount) * Number(c.amount) / 100).toFixed(2)} {selectedToken.symbol}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setContributors([...contributors, { wallet: publicKey?.toBase58() ?? "", amount: "" }])}
                className="text-xs text-emerald-400 hover:text-emerald-300 mt-1.5 transition">
                Add my wallet
              </button>
            </div>

            {/* Release mode */}
            <div>
              <label className="text-sm text-white/60 block mb-2">Release mode</label>
              <div className="grid grid-cols-2 gap-3">
                {RELEASE_MODES.map(m => (
                  <button key={m.value} onClick={() => setReleaseMode(m.value as "auto" | "manual")}
                    className={`p-4 rounded-xl border text-left transition ${
                      releaseMode === m.value
                        ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                        : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                    }`}>
                    <p className="font-semibold text-sm">{m.label}</p>
                    <p className="text-xs mt-1 opacity-70">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Threshold */}
            <div>
              <label className="text-sm text-white/60 block mb-2">Release threshold</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "allIn", label: "All in", desc: "Wait for every contributor" },
                  { value: "partial", label: "Partial", desc: "Release once min # deposit" },
                ].map(t => (
                  <button key={t.value} onClick={() => setThresholdType(t.value as "allIn" | "partial")}
                    className={`p-4 rounded-xl border text-left transition ${
                      thresholdType === t.value
                        ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                        : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                    }`}>
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs mt-1 opacity-70">{t.desc}</p>
                  </button>
                ))}
              </div>
              {thresholdType === "partial" && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-white/50">Minimum contributors needed:</label>
                  <input type="number" min={1} max={contributors.length}
                    value={minCount} onChange={e => setMinCount(Number(e.target.value))}
                    className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-center" />
                  <span className="text-white/30 text-sm">of {contributors.length}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Summary */}
        {name && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-sm space-y-1">
            <p className="text-emerald-400 font-semibold">Pot summary</p>
            {potKind === 'fundraise' && targetAmount && (
              <p className="text-white/60">
                Fundraise goal: <span className="text-white font-semibold">{targetAmount} {selectedToken.symbol}</span>
                {' · '}{fundraiseMode === 'fixedLimit' ? 'Auto-releases at target' : 'Ruggable (creator controls release)'}
              </p>
            )}
            {potKind === 'contribution' && contributionMode === "equalFixed" && amountPerContributor && (
              <p className="text-white/60">
                {contributors.length} contributor{contributors.length !== 1 ? "s" : ""} × {amountPerContributor} {selectedToken.symbol} ={" "}
                <span className="text-white font-semibold">{(contributors.length * Number(amountPerContributor)).toFixed(2)} {selectedToken.symbol}</span> total
              </p>
            )}
            {potKind === 'contribution' && contributionMode === "customFixed" && (
              <p className="text-white/60">Custom amounts per contributor</p>
            )}
            {potKind === 'contribution' && contributionMode === "percentOfTarget" && targetAmount && (
              <p className="text-white/60">Target: <span className="text-white font-semibold">{targetAmount} {selectedToken.symbol}</span>, split by % per contributor</p>
            )}
            {potKind === 'contribution' && (
              <p className="text-white/60">
                Release: <span className="text-white">{releaseMode}</span> · Threshold:{" "}
                <span className="text-white">{thresholdType === "allIn" ? "all in" : `${minCount} of ${contributors.length}`}</span>
              </p>
            )}
          </div>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400 space-y-2">
            <p>✓ {success.split("\n")[0]}</p>
            {success.split("\n")[1] && <p className="text-xs opacity-70 font-mono">{success.split("\n")[1]}</p>}
            <Link href={`/pots/${success.match(/\/pots\/([\w]+)/)?.[1]}`}
              className="inline-block mt-1 text-emerald-300 underline hover:text-emerald-200">
              View pot →
            </Link>
          </div>
        )}

        <button onClick={handleCreate}
          disabled={loading || !name || !recipient || (potKind === 'contribution' && contributors.length === 0)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold py-4 rounded-2xl transition text-base">
          {loading ? "Creating pot…" : potKind === 'fundraise' ? "Create fundraise 🎯" : "Create pot ♠"}
        </button>
      </div>
    </main>
  );
}
