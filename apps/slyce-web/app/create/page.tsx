"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { SUPPORTED_TOKENS, MAX_RECIPIENTS, BASIS_POINTS } from "@/lib/constants";
import { createSplit, type DistributionMode } from "@/lib/program";

interface Recipient {
  address: string;
  share: number; // percentage (0-100) for Percentage mode, fixed amount for Fixed mode
  label: string;
}

const DEFAULT_RECIPIENT: Recipient = { address: "", share: 0, label: "" };

const DISTRIBUTION_MODES: { value: DistributionMode; label: string; desc: string }[] = [
  { value: "percentage", label: "Percentage", desc: "Each recipient gets a % of the vault" },
  { value: "fixed", label: "Fixed", desc: "Each recipient gets a set token amount" },
  { value: "equal", label: "Equal", desc: "Vault divided equally among all recipients" },
];

export default function CreateSplit() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedToken, setSelectedToken] = useState(SUPPORTED_TOKENS[0]);
  const [customMint, setCustomMint] = useState("");
  const [showCustomMintModal, setShowCustomMintModal] = useState(false);
  const [customMintInput, setCustomMintInput] = useState("");
  const [autoDistribute, setAutoDistribute] = useState(true);
  const [distributionMode, setDistributionMode] = useState<DistributionMode>("percentage");
  const [recipients, setRecipients] = useState<Recipient[]>([
    { ...DEFAULT_RECIPIENT, share: 100 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const totalShare = recipients.reduce((sum, r) => sum + (r.share || 0), 0);
  const sharesValidForPercentage = totalShare === 100;
  const sharesValidForFixed = recipients.every((r) => r.share > 0);

  const sharesValid =
    distributionMode === "percentage"
      ? sharesValidForPercentage
      : distributionMode === "fixed"
      ? sharesValidForFixed
      : true; // equal — no share validation needed

  const addRecipient = () => {
    if (recipients.length >= MAX_RECIPIENTS) return;
    setRecipients([...recipients, { ...DEFAULT_RECIPIENT }]);
  };

  const removeRecipient = (i: number) => {
    setRecipients(recipients.filter((_, idx) => idx !== i));
  };

  const updateRecipient = (i: number, field: keyof Recipient, value: string | number) => {
    setRecipients(
      recipients.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    );
  };

  const handleTokenSelect = (token: typeof SUPPORTED_TOKENS[0]) => {
    if (token.symbol === "CUSTOM") {
      setShowCustomMintModal(true);
    } else {
      setSelectedToken(token);
    }
  };

  const confirmCustomMint = () => {
    try {
      new PublicKey(customMintInput);
      setSelectedToken({
        symbol: "CUSTOM",
        name: "Custom SPL Token",
        mint: customMintInput,
        decimals: 0,
        logo: "",
      });
      setShowCustomMintModal(false);
    } catch {
      setError("Invalid mint address");
    }
  };

  const handleCreate = useCallback(async () => {
    if (!connected || !publicKey || !anchorWallet) return;
    setError("");
    setLoading(true);

    try {
      // Validate
      if (!name.trim()) throw new Error("Split name is required");

      if (distributionMode === "percentage" && !sharesValidForPercentage) {
        throw new Error("Shares must total exactly 100%");
      }
      if (distributionMode === "fixed" && !sharesValidForFixed) {
        throw new Error("All recipients must have a fixed amount > 0");
      }

      for (const r of recipients) {
        if (!r.address) throw new Error("All recipient addresses are required");
        try { new PublicKey(r.address); } catch { throw new Error(`Invalid address: ${r.address}`); }
      }

      const mint = new PublicKey(selectedToken.mint);
      const seed = crypto.getRandomValues(new Uint8Array(8));

      // Build share_value per recipient based on mode
      const mappedRecipients = recipients.map((r) => {
        let share_value = 0;
        if (distributionMode === "percentage") {
          share_value = Math.round(r.share * 100); // % → bps
        } else if (distributionMode === "fixed") {
          // Convert human-readable to raw token units
          share_value = Math.round(r.share * Math.pow(10, selectedToken.decimals));
        } else {
          share_value = 0; // equal — ignored on-chain
        }
        return {
          address: new PublicKey(r.address),
          share_value,
          label: r.label || "",
        };
      });

      const { tx, splitAddress } = await createSplit(connection, anchorWallet, publicKey, {
        seed,
        name: name.trim(),
        description: description.trim(),
        mint,
        recipients: mappedRecipients,
        distributionMode,
        autoDistribute,
      });

      setSuccess(`Split created! Address: ${splitAddress} | Tx: ${tx}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, anchorWallet, connection, name, description, selectedToken, recipients, autoDistribute, distributionMode, sharesValidForPercentage, sharesValidForFixed]);

  if (!connected) {
    return (
      <main className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Connect your wallet to create a split</h1>
        <WalletMultiButton className="!bg-purple-600 !rounded-lg" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080c14] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e1420]">
        <Link href="/" className="text-xl font-bold tracking-tight">slyce</Link>
        <WalletMultiButton className="!bg-purple-600 !rounded-lg !text-sm" />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Create a Split</h1>
          <p className="text-white/50 mt-1">Define recipients and shares. Locks after first deposit.</p>
        </div>

        {/* Name & Description */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">Split Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Team Revenue Split"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this split for?"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
        </div>

        {/* Token Selection */}
        <div>
          <label className="text-sm text-white/60 mb-2 block">Token</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SUPPORTED_TOKENS.map(token => (
              <button
                key={token.symbol}
                onClick={() => handleTokenSelect(token)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                  selectedToken.symbol === token.symbol
                    ? "border-purple-500 bg-purple-500/10 text-white"
                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/30"
                }`}
              >
                {token.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={token.logo} alt={token.symbol} className="w-5 h-5 rounded-full" />
                )}
                {token.symbol === "CUSTOM" && !token.logo && <span>🪙</span>}
                {token.symbol}
              </button>
            ))}
          </div>
          {selectedToken.symbol === "CUSTOM" && selectedToken.mint && (
            <p className="text-xs text-white/40 mt-2 font-mono">{selectedToken.mint}</p>
          )}
        </div>

        {/* Distribution Mode Selector */}
        <div>
          <label className="text-sm text-white/60 mb-2 block">Distribution Mode</label>
          <div className="grid grid-cols-3 gap-3">
            {DISTRIBUTION_MODES.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDistributionMode(opt.value)}
                className={`text-left px-4 py-3 rounded-xl border transition ${
                  distributionMode === opt.value
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-white/40 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Auto-distribute */}
        <div>
          <label className="text-sm text-white/60 mb-2 block">Claim Mode</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: true, label: "Auto-distribute", desc: "Pays out on every deposit" },
              { value: false, label: "Manual claim", desc: "Recipients claim when ready" },
            ].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setAutoDistribute(opt.value)}
                className={`text-left px-4 py-3 rounded-xl border transition ${
                  autoDistribute === opt.value
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-white/40 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Recipients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-white/60">
              Recipients ({recipients.length}/{MAX_RECIPIENTS})
            </label>
            {distributionMode === "percentage" && (
              <span className={`text-sm font-mono ${sharesValidForPercentage ? "text-green-400" : "text-red-400"}`}>
                {totalShare}% / 100%
              </span>
            )}
          </div>

          {distributionMode === "equal" && (
            <div className="mb-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3 text-sm text-purple-300">
              ✦ Vault will be divided equally among all {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
            </div>
          )}

          <div className="space-y-3">
            {recipients.map((r, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Recipient {i + 1}</span>
                  {recipients.length > 1 && (
                    <button onClick={() => removeRecipient(i)} className="text-red-400 text-xs hover:text-red-300">
                      Remove
                    </button>
                  )}
                </div>
                <input
                  value={r.address}
                  onChange={e => updateRecipient(i, "address", e.target.value)}
                  placeholder="Wallet address"
                  className="w-full bg-[#080c14]/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-purple-500"
                />
                <div className={`grid ${distributionMode !== "equal" ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                  <input
                    value={r.label}
                    onChange={e => updateRecipient(i, "label", e.target.value)}
                    placeholder="Label (e.g. Dev, Marketing)"
                    className="bg-[#080c14]/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500"
                  />
                  {distributionMode === "percentage" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={r.share}
                        onChange={e => updateRecipient(i, "share", Number(e.target.value))}
                        placeholder="Share %"
                        className="w-full bg-[#080c14]/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500"
                      />
                      <span className="text-white/40 text-sm">%</span>
                    </div>
                  )}
                  {distributionMode === "fixed" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={r.share}
                        onChange={e => updateRecipient(i, "share", Number(e.target.value))}
                        placeholder={`Amount (${selectedToken.symbol})`}
                        className="w-full bg-[#080c14]/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500"
                      />
                      <span className="text-white/40 text-sm shrink-0">{selectedToken.symbol}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {recipients.length < MAX_RECIPIENTS && (
            <button
              onClick={addRecipient}
              className="mt-3 w-full border border-dashed border-white/20 rounded-xl py-2.5 text-sm text-white/40 hover:text-white/60 hover:border-white/30 transition"
            >
              + Add recipient
            </button>
          )}
        </div>

        {/* Fee notice */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3 text-sm text-purple-300">
          💡 Protocol fee: <strong>1%</strong> is taken on each deposit. Recipients always get 99% of what's sent.
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
            {success}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || !sharesValid}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition text-sm"
        >
          {loading ? "Creating split..." : "Create Split →"}
        </button>
      </div>

      {/* Custom Mint Modal */}
      {showCustomMintModal && (
        <div className="fixed inset-0 bg-[#080c14]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Enter SPL Token Mint Address</h2>
            <input
              value={customMintInput}
              onChange={e => setCustomMintInput(e.target.value)}
              placeholder="e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCustomMintModal(false)}
                className="flex-1 border border-white/10 rounded-xl py-2.5 text-sm text-white/60 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmCustomMint}
                className="flex-1 bg-purple-600 hover:bg-purple-700 rounded-xl py-2.5 text-sm text-white font-medium transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
