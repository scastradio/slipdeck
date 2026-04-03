"use client";

import { useState, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { KNOWN_TOKENS, PROTOCOL_FEE_LAMPORTS_PER_WALLET, BATCH_SIZE } from "@/lib/constants";
import { createAirdrop, fundAirdrop, fetchMintInfo, getProtocolConfigPDA } from "@/lib/program";

interface ParsedRecipient {
  wallet: string;
  amount: string;
  valid: boolean;
  error?: string;
}

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function parseRecipientList(raw: string, hasAmounts: boolean): ParsedRecipient[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  return lines.map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    const wallet = parts[0];
    const amount = hasAmounts && parts[1] ? parts[1] : "";

    if (!wallet) return { wallet: "", amount, valid: false, error: "Empty address" };
    if (!isValidSolanaAddress(wallet)) return { wallet, amount, valid: false, error: "Invalid address" };
    if (hasAmounts && (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      return { wallet, amount, valid: false, error: "Invalid amount" };
    }
    return { wallet, amount, valid: true };
  });
}

function detectHasAmounts(raw: string): boolean {
  const firstLine = raw.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine) return false;
  return firstLine.includes(",");
}

export default function CreatePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [rawInput, setRawInput] = useState("");
  const [recipients, setRecipients] = useState<ParsedRecipient[]>([]);
  const [hasAmounts, setHasAmounts] = useState(false);
  const [parsed, setParsed] = useState(false);

  // Step 2
  const [name, setName] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [mintInfo, setMintInfo] = useState<{ symbol: string; decimals: number } | null>(null);
  const [mintLoading, setMintLoading] = useState(false);
  const [mintError, setMintError] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [mode, setMode] = useState<"push" | "claim">("push");

  // Step 3 / execution
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successAddress, setSuccessAddress] = useState("");
  const [txStep, setTxStep] = useState("");

  const handleMintAddressChange = useCallback(async (val: string) => {
    setMintAddress(val);
    setMintError("");
    setMintInfo(null);
    if (val.length < 32) return;
    // Check known tokens first
    const known = KNOWN_TOKENS.find(t => t.mint === val);
    if (known) {
      setMintInfo({ symbol: known.symbol, decimals: known.decimals });
      return;
    }
    setMintLoading(true);
    try {
      const info = await fetchMintInfo(connection, val);
      if (!info) {
        setMintError("Not a valid SPL mint address");
      } else {
        setMintInfo({ symbol: "Unknown", decimals: info.decimals });
      }
    } catch {
      setMintError("Failed to fetch token info");
    } finally {
      setMintLoading(false);
    }
  }, [connection]);

  const handleMintSelect = useCallback(async (mint: string) => {
    setMintAddress(mint);
    setMintError("");
    setMintInfo(null);
    const known = KNOWN_TOKENS.find(t => t.mint === mint);
    if (known) {
      setMintInfo({ symbol: known.symbol, decimals: known.decimals });
      return;
    }
    setMintLoading(true);
    try {
      const info = await fetchMintInfo(connection, mint);
      if (info) setMintInfo({ symbol: "Unknown", decimals: info.decimals });
    } finally {
      setMintLoading(false);
    }
  }, [connection]);

  const handleParse = useCallback(() => {
    const detected = detectHasAmounts(rawInput);
    setHasAmounts(detected);
    const parsed = parseRecipientList(rawInput, detected);
    setRecipients(parsed);
    setParsed(true);
  }, [rawInput]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawInput(ev.target?.result as string);
      setParsed(false);
    };
    reader.readAsText(file);
  };

  const validRecipients = recipients.filter((r) => r.valid);
  const invalidCount = recipients.filter((r) => !r.valid).length;
  const validCount = validRecipients.length;

  const decimals = mintInfo?.decimals ?? 6;

  const computedRecipients = useCallback(() => {
    if (!hasAmounts && totalAmount) {
      const amt = parseFloat(totalAmount);
      if (amt > 0 && validRecipients.length > 0) {
        const perWallet = (amt / validRecipients.length).toFixed(decimals);
        return validRecipients.map((r) => ({ ...r, amount: perWallet }));
      }
    }
    return validRecipients;
  }, [hasAmounts, totalAmount, validRecipients, decimals]);

  const finalRecipients = computedRecipients();
  const totalTokens = finalRecipients.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
  const protocolFeeSol = (validRecipients.length * PROTOCOL_FEE_LAMPORTS_PER_WALLET) / 1e9;
  const ataFeeSol = mode === "push" ? validRecipients.length * 0.002 : 0;
  const totalSolNeeded = protocolFeeSol + ataFeeSol;

  const canProceedStep1 = parsed && validRecipients.length > 0;
  const canProceedStep2 =
    name.trim().length > 0 &&
    mintAddress.length > 0 &&
    mintInfo !== null &&
    (hasAmounts ? true : parseFloat(totalAmount) > 0) &&
    finalRecipients.every((r) => parseFloat(r.amount) > 0);

  const downloadCSV = () => {
    const lines = ["wallet,amount", ...finalRecipients.map((r) => `${r.wallet},${r.amount}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drop-distribution-${name || "airdrop"}.csv`;
    a.click();
  };

  const handleCreate = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError("Connect your wallet first");
      return;
    }
    if (!mintInfo) {
      setError("Please select a valid token");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Fetch protocol config to get treasury
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const programLib: any = await import("@/lib/program");
      const program = programLib.getProgram(connection, wallet);
      const [configPDA] = getProtocolConfigPDA();

      let treasuryAddress: string;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = await (program.account as any).protocolConfig.fetch(configPDA);
        treasuryAddress = config.treasury.toBase58();
      } catch {
        setError("Protocol not initialized on devnet yet. Contact admin.");
        setLoading(false);
        return;
      }

      const tokenDecimals = mintInfo.decimals;
      const amountPerWallet = hasAmounts
        ? null
        : (parseFloat(totalAmount) * Math.pow(10, tokenDecimals)) / finalRecipients.length;

      // Split into batches of BATCH_SIZE
      const batches: ParsedRecipient[][] = [];
      for (let i = 0; i < finalRecipients.length; i += BATCH_SIZE) {
        batches.push(finalRecipients.slice(i, i + BATCH_SIZE));
      }

      const createdDrops: string[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setTxStep(
          batches.length > 1
            ? `Batch ${i + 1}/${batches.length}: creating airdrop...`
            : "Step 1/2: Creating airdrop on-chain..."
        );

        const seed = Array.from(crypto.getRandomValues(new Uint8Array(8)));

        const recipientParams = batch.map((r) => ({
          wallet: r.wallet,
          amount: BigInt(
            hasAmounts
              ? Math.floor(parseFloat(r.amount) * Math.pow(10, tokenDecimals))
              : Math.floor(amountPerWallet!)
          ),
        }));

        const batchName = batches.length > 1 ? `${name.trim()} (${i + 1}/${batches.length})` : name.trim();

        const airdropAddress = await createAirdrop(connection, wallet, wallet.publicKey, {
          name: batchName,
          mode,
          mint: mintAddress,
          recipients: recipientParams,
          seed,
        });

        setTxStep(
          batches.length > 1
            ? `Batch ${i + 1}/${batches.length}: funding vault...`
            : "Step 2/2: Funding vault..."
        );

        await fundAirdrop(
          connection,
          wallet,
          wallet.publicKey,
          airdropAddress,
          mintAddress,
          treasuryAddress
        );

        createdDrops.push(airdropAddress);
      }

      setSuccessAddress(createdDrops[0]);
      if (createdDrops.length > 1) {
        setTxStep(`✅ ${createdDrops.length} drops created successfully!`);
      } else {
        setTxStep("");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setTxStep("");
    } finally {
      setLoading(false);
    }
  };

  if (successAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#080c10" }}>
        <div className="max-w-lg w-full text-center">
          <div className="text-5xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-white mb-4">Airdrop created!</h1>
          <p className="text-slate-400 mb-6">
            Your airdrop has been created and funded. Recipients can now be paid.
          </p>
          <div className="p-4 rounded-lg border mb-6 font-mono text-sm break-all text-left"
            style={{ background: "#0d1117", borderColor: "#1e293b", color: "#0ea5e9" }}>
            {successAddress}
          </div>
          {txStep && (
            <p className="text-emerald-400 text-sm mb-4">{txStep}</p>
          )}
          <div className="flex gap-3 justify-center">
            <Link
              href={`/drops/${successAddress}`}
              className="px-6 py-2.5 rounded-lg font-semibold text-white transition-all"
              style={{ background: "#0ea5e9" }}
            >
              View airdrop →
            </Link>
            <button
              onClick={() => {
                setSuccessAddress("");
                setStep(1);
                setRawInput("");
                setRecipients([]);
                setParsed(false);
                setName("");
                setMintAddress("");
                setMintInfo(null);
                setTotalAmount("");
                setTxStep("");
              }}
              className="px-6 py-2.5 rounded-lg font-semibold text-slate-300 border border-slate-700 hover:border-slate-500"
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#080c10" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: "#0ea5e9" }}>Drop</span>
        </Link>
        <WalletMultiButton style={{
          background: "#0ea5e9", color: "#fff", borderRadius: "8px",
          fontSize: "14px", height: "36px", padding: "0 16px",
        }} />
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Steps indicator */}
        <div className="flex items-center gap-0 mb-12">
          {[
            { n: 1, label: "Recipients" },
            { n: 2, label: "Configure" },
            { n: 3, label: "Preview & Fund" },
          ].map(({ n, label }, i) => (
            <div key={n} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={{
                    background: step >= n ? "#0ea5e9" : "#1e293b",
                    color: step >= n ? "#fff" : "#64748b",
                  }}
                >
                  {step > n ? "✓" : n}
                </div>
                <span
                  className="text-sm font-medium hidden sm:block"
                  style={{ color: step >= n ? "#e2e8f0" : "#64748b" }}
                >
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div
                  className="flex-1 h-px mx-3"
                  style={{ background: step > n ? "#0ea5e9" : "#1e293b" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Upload recipients</h2>
              <p className="text-slate-400 text-sm">
                Paste wallet addresses (one per line) or CSV with amounts (wallet,amount). No wallet limit — auto-batched into groups of {BATCH_SIZE}.
              </p>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
              <div className="flex items-center justify-between px-4 py-2 border-b"
                style={{ background: "#0d1117", borderColor: "#1e293b" }}>
                <span className="text-xs text-slate-500 font-mono">recipients.csv</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs px-3 py-1 rounded border text-slate-400 hover:text-slate-200 transition-colors"
                  style={{ borderColor: "#334155" }}
                >
                  Upload file ↑
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              <textarea
                value={rawInput}
                onChange={(e) => { setRawInput(e.target.value); setParsed(false); }}
                placeholder={"# Paste wallets (one per line) or wallet,amount pairs\nABCDEF...wallet1\nGHIJKL...wallet2,100\n\n# Or use equal split format:\nABCDEF...wallet1\nGHIJKL...wallet2"}
                rows={12}
                className="w-full p-4 font-mono text-sm text-slate-300 resize-none outline-none"
                style={{ background: "#080c10", lineHeight: 1.6 }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleParse}
                disabled={!rawInput.trim()}
                className="px-6 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: "#0ea5e9" }}
              >
                Parse & validate
              </button>
              {parsed && (
                <div className="flex items-center gap-2 text-sm">
                  {validRecipients.length > 0 && (
                    <span className="text-green-400">✓ {validRecipients.length} valid</span>
                  )}
                  {invalidCount > 0 && (
                    <span className="text-red-400">✗ {invalidCount} invalid</span>
                  )}
                </div>
              )}
            </div>

            {/* Auto-batching notice */}
            {parsed && validRecipients.length > BATCH_SIZE && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
                <p className="font-semibold">📦 Auto-batching enabled</p>
                <p className="text-amber-300/70 mt-1">
                  {validRecipients.length.toLocaleString()} wallets → {Math.ceil(validRecipients.length / BATCH_SIZE)} drops of up to {BATCH_SIZE} each.
                  All funded in sequence automatically.
                </p>
              </div>
            )}

            {/* Preview table */}
            {parsed && recipients.length > 0 && (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
                <div className="px-4 py-2 border-b text-xs text-slate-500"
                  style={{ background: "#0d1117", borderColor: "#1e293b" }}>
                  PREVIEW — {recipients.length} entries
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "#1e293b" }}>
                        <th className="px-4 py-2 text-left text-slate-500 font-medium">#</th>
                        <th className="px-4 py-2 text-left text-slate-500 font-medium">Wallet</th>
                        {hasAmounts && <th className="px-4 py-2 text-right text-slate-500 font-medium">Amount</th>}
                        <th className="px-4 py-2 text-right text-slate-500 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b last:border-0"
                          style={{
                            borderColor: "#1e293b",
                            background: r.valid ? "transparent" : "#1c0a0a",
                          }}
                        >
                          <td className="px-4 py-2 text-slate-600 font-mono">{i + 1}</td>
                          <td className="px-4 py-2 font-mono text-slate-300 text-xs">
                            {r.wallet
                              ? `${r.wallet.slice(0, 6)}...${r.wallet.slice(-4)}`
                              : <span className="text-red-400">empty</span>}
                          </td>
                          {hasAmounts && (
                            <td className="px-4 py-2 text-right text-slate-300">{r.amount || "—"}</td>
                          )}
                          <td className="px-4 py-2 text-right">
                            {r.valid ? (
                              <span className="text-green-400 text-xs">✓ valid</span>
                            ) : (
                              <span className="text-red-400 text-xs">✗ {r.error}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="px-8 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: "#0ea5e9" }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Configure airdrop</h2>
              <p className="text-slate-400 text-sm">Set a name, token, and distribution mode.</p>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Airdrop name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Community airdrop Q1 2025"
                  className="w-full px-4 py-3 rounded-lg border text-white outline-none focus:border-sky-500 transition-colors"
                  style={{ background: "#0d1117", borderColor: "#1e293b" }}
                />
              </div>

              {/* Token selector */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-400">Token (any SPL mint)</label>

                {/* Quick select well-known tokens */}
                <div className="flex gap-2 flex-wrap">
                  {KNOWN_TOKENS.map(t => (
                    <button
                      key={t.mint}
                      onClick={() => handleMintSelect(t.mint)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                        mintAddress === t.mint
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      {t.symbol}
                    </button>
                  ))}
                  <button
                    onClick={() => { setMintAddress(""); setMintInfo(null); setMintError(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/5 text-white/40 hover:border-white/20 transition"
                  >
                    custom
                  </button>
                </div>

                {/* Mint address input */}
                <div className="relative">
                  <input
                    type="text"
                    value={mintAddress}
                    onChange={e => handleMintAddressChange(e.target.value)}
                    placeholder="Paste any SPL token mint address..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-amber-500/50 font-mono"
                  />
                  {mintLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">loading...</div>
                  )}
                </div>

                {mintError && <p className="text-red-400 text-xs">{mintError}</p>}

                {mintInfo && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    ✓ {mintInfo.symbol || 'Unknown token'} — {mintInfo.decimals} decimals
                  </div>
                )}
              </div>

              {/* Amount (only if no amounts in CSV) */}
              {!hasAmounts ? (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Total amount to distribute
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="e.g. 1000"
                      className="w-full px-4 py-3 rounded-lg border text-white outline-none focus:border-sky-500 transition-colors pr-24"
                      style={{ background: "#0d1117", borderColor: "#1e293b" }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">
                      {mintInfo?.symbol || "tokens"}
                    </span>
                  </div>
                  {totalAmount && parseFloat(totalAmount) > 0 && validRecipients.length > 0 && mintInfo && (
                    <p className="text-xs text-slate-500 mt-1">
                      = {(parseFloat(totalAmount) / validRecipients.length).toFixed(mintInfo.decimals)} {mintInfo.symbol} per wallet
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Total (from CSV)</label>
                  <div className="px-4 py-3 rounded-lg border text-slate-300 font-mono"
                    style={{ background: "#0d1117", borderColor: "#1e293b" }}>
                    {validRecipients.reduce((s, r) => s + parseFloat(r.amount || "0"), 0).toFixed(mintInfo?.decimals ?? 6)} {mintInfo?.symbol || "tokens"}
                  </div>
                </div>
              )}

              {/* Mode selector */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Distribution mode</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["push", "claim"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="p-4 rounded-lg border text-left transition-all"
                      style={{
                        background: mode === m ? "#0ea5e910" : "#0d1117",
                        borderColor: mode === m ? "#0ea5e9" : "#1e293b",
                      }}
                    >
                      <div className="text-lg mb-1">{m === "push" ? "⚡" : "✋"}</div>
                      <div className="font-semibold text-sm" style={{ color: mode === m ? "#0ea5e9" : "#e2e8f0" }}>
                        {m === "push" ? "Push" : "Claim"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {m === "push"
                          ? "You send tokens to all wallets automatically"
                          : "Recipients claim their own tokens when ready"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="px-8 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: "#0ea5e9" }}
              >
                Preview →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Fund */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Preview & Fund</h2>
              <p className="text-slate-400 text-sm">
                Review your airdrop before committing.{validCount > BATCH_SIZE ? ` ${Math.ceil(validCount / BATCH_SIZE)} batches will be created.` : " Two transactions required."}
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Name", value: name },
                { label: "Token", value: mintInfo?.symbol || mintAddress.slice(0, 8) + "..." },
                { label: "Mode", value: mode === "push" ? "⚡ Push" : "✋ Claim" },
                { label: "Recipients", value: finalRecipients.length.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-lg border" style={{ background: "#0d1117", borderColor: "#1e293b" }}>
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className="text-sm font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>

            {/* Auto-batching notice */}
            {validCount > BATCH_SIZE && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
                <p className="font-semibold">📦 Auto-batching enabled</p>
                <p className="text-amber-300/70 mt-1">
                  {validCount.toLocaleString()} wallets → {Math.ceil(validCount / BATCH_SIZE)} drops of up to {BATCH_SIZE} each.
                  All funded in sequence automatically.
                </p>
              </div>
            )}

            {/* Recipients table */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e293b" }}>
              <div className="px-4 py-2 border-b text-xs text-slate-500"
                style={{ background: "#0d1117", borderColor: "#1e293b" }}>
                DISTRIBUTION — {finalRecipients.length} wallets
              </div>
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
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
                    {finalRecipients.map((r, i) => (
                      <tr key={i} className="border-b last:border-0" style={{ borderColor: "#1e293b" }}>
                        <td className="px-4 py-2 text-slate-600 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-2 font-mono text-slate-300 text-xs">
                          {r.wallet.slice(0, 6)}...{r.wallet.slice(-4)}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-200">
                          {parseFloat(r.amount).toFixed(decimals === 6 ? 2 : 4)} {mintInfo?.symbol || ""}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-xs px-2 py-0.5 rounded-full text-yellow-400 border border-yellow-400/20 bg-yellow-400/5">
                            pending
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="p-5 rounded-xl border space-y-3" style={{ background: "#0d1117", borderColor: "#1e293b" }}>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Cost breakdown</h3>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total tokens</span>
                <span className="text-white font-mono">
                  {totalTokens.toFixed(decimals === 6 ? 2 : 4)} {mintInfo?.symbol || "tokens"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Protocol fee (0.001 SOL × {finalRecipients.length})</span>
                <span className="text-white font-mono">{protocolFeeSol.toFixed(3)} SOL</span>
              </div>
              {validCount > BATCH_SIZE && (
                <div className="text-xs text-amber-300/60 text-right">
                  across {Math.ceil(validCount / BATCH_SIZE)} batches
                </div>
              )}
              {mode === "push" && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ATA creation est. (~0.002 SOL × {finalRecipients.length})</span>
                  <span className="text-yellow-400 font-mono">~{ataFeeSol.toFixed(3)} SOL</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between text-sm font-semibold" style={{ borderColor: "#1e293b" }}>
                <span className="text-slate-300">Total SOL needed</span>
                <span className="font-mono" style={{ color: "#0ea5e9" }}>
                  {mode === "push" ? `~${totalSolNeeded.toFixed(3)}` : protocolFeeSol.toFixed(3)} SOL
                </span>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                {error}
              </div>
            )}

            {txStep && (
              <div className="p-4 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-400 text-sm flex items-center gap-2">
                <span className="animate-spin">⏳</span> {txStep}
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={downloadCSV}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 border border-slate-700 hover:border-slate-500 transition-colors"
                >
                  ↓ Download CSV
                </button>
              </div>

              {!wallet.connected ? (
                <WalletMultiButton style={{
                  background: "#0ea5e9", color: "#fff", borderRadius: "8px",
                  fontSize: "14px", height: "42px", padding: "0 20px",
                }} />
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-8 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-60 flex items-center gap-2"
                  style={{ background: "#0ea5e9", boxShadow: "0 0 24px #0ea5e940" }}
                >
                  {loading ? (
                    <><span className="animate-spin">⏳</span> Processing...</>
                  ) : (
                    <>Confirm & Create →</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
