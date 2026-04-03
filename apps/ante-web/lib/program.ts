/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import IDL from "./ante.json";
import { PROGRAM_ID, POT_SEED, PROTOCOL_CONFIG_SEED } from "./constants";

export function getProgram(connection: Connection, wallet: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(IDL as any, provider);
}

export function getProtocolConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROTOCOL_CONFIG_SEED], PROGRAM_ID);
}

export function getPotPDA(creator: PublicKey, seed: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POT_SEED, creator.toBuffer(), seed],
    PROGRAM_ID
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReleaseMode = "auto" | "manual";
export type ThresholdType = "allIn" | "partial";
export type ContributionMode = "equalFixed" | "customFixed" | "percentOfTarget";

export interface OnChainContributor {
  wallet: string;
  requiredAmount: string;
  deposited: boolean;
  amount: string;
}

export interface OnChainPot {
  address: string;
  creator: string;
  mint: string;
  recipient: string;
  amountPerContributor: string;
  targetAmount: string;
  contributionMode: ContributionMode;
  contributors: OnChainContributor[];
  releaseMode: ReleaseMode;
  threshold: { allIn: {} } | { partial: { minCount: number } };
  status: "open" | "released" | "cancelled";
  totalDeposited: string;
  bump: number;
  createdAt: number;
  seed: number[];
  name: string;
  description: string;
  kind: 'contribution' | 'fundraise';
  fundraiseMode: 'fixedLimit' | 'ruggable';
}

function parseStatus(s: any): "open" | "released" | "cancelled" {
  if (s.open !== undefined) return "open";
  if (s.released !== undefined) return "released";
  return "cancelled";
}

function parseReleaseMode(r: any): ReleaseMode {
  return r.auto !== undefined ? "auto" : "manual";
}

function parseContributionMode(m: any): ContributionMode {
  if (m.equalFixed !== undefined) return "equalFixed";
  if (m.customFixed !== undefined) return "customFixed";
  return "percentOfTarget";
}

function mapPot(publicKey: PublicKey, a: any): OnChainPot {
  return {
    address: publicKey.toBase58(),
    creator: a.creator.toBase58(),
    mint: a.mint.toBase58(),
    recipient: a.recipient.toBase58(),
    amountPerContributor: a.amountPerContributor.toString(),
    targetAmount: a.targetAmount.toString(),
    contributionMode: parseContributionMode(a.contributionMode),
    contributors: a.contributors.map((c: any) => ({
      wallet: c.wallet.toBase58(),
      requiredAmount: c.requiredAmount.toString(),
      deposited: c.deposited,
      amount: c.amount.toString(),
    })),
    releaseMode: parseReleaseMode(a.releaseMode),
    threshold: a.threshold,
    status: parseStatus(a.status),
    totalDeposited: a.totalDeposited.toString(),
    bump: a.bump,
    createdAt: a.createdAt.toNumber(),
    seed: a.seed,
    name: a.name,
    description: a.description,
    kind: a.kind?.fundraise !== undefined ? 'fundraise' : 'contribution',
    fundraiseMode: a.fundraiseMode?.ruggable !== undefined ? 'ruggable' : 'fixedLimit',
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchAllPots(
  connection: Connection,
  wallet: AnchorWallet
): Promise<OnChainPot[]> {
  const program = getProgram(connection, wallet);
  try {
    const accounts = await (program.account as any).pot.all();
    return accounts
      .map((a: any) => mapPot(a.publicKey, a.account))
      .sort((a: any, b: any) => b.createdAt - a.createdAt);
  } catch { return []; }
}

export async function fetchPot(
  connection: Connection,
  wallet: AnchorWallet,
  address: string
): Promise<OnChainPot | null> {
  const program = getProgram(connection, wallet);
  try {
    const a = await (program.account as any).pot.fetch(new PublicKey(address));
    return mapPot(new PublicKey(address), a);
  } catch { return null; }
}

export async function fetchVaultBalance(
  connection: Connection,
  potAddress: string,
  mintAddress: string
): Promise<number> {
  try {
    const pot = new PublicKey(potAddress);
    const mint = new PublicKey(mintAddress);
    const vault = getAssociatedTokenAddressSync(mint, pot, true);
    const info = await connection.getTokenAccountBalance(vault);
    return info.value.uiAmount ?? 0;
  } catch { return 0; }
}

// ─── Instructions ─────────────────────────────────────────────────────────────

export interface ContributorParam {
  wallet: PublicKey;
  requiredAmount: number; // raw units for customFixed, bps for percentOfTarget, 0 for equalFixed
}

export async function createPot(
  connection: Connection,
  wallet: AnchorWallet,
  creator: PublicKey,
  args: {
    seed: Uint8Array;
    name: string;
    description: string;
    mint: PublicKey;
    recipient: PublicKey;
    amountPerContributor: number;
    targetAmount: number;
    decimals: number;
    contributionMode: ContributionMode;
    contributors: ContributorParam[];
    releaseMode: ReleaseMode;
    threshold: { type: "allIn" } | { type: "partial"; minCount: number };
    kind: 'contribution' | 'fundraise';
    fundraiseMode: 'fixedLimit' | 'ruggable';
  }
) {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();
  const [pot] = getPotPDA(creator, args.seed);

  const thresholdParam =
    args.threshold.type === "allIn"
      ? { allIn: {} }
      : { partial: { minCount: args.threshold.minCount } };

  const releaseModeParam =
    args.releaseMode === "auto" ? { auto: {} } : { manual: {} };

  let contributionModeParam: any;
  if (args.contributionMode === "equalFixed") {
    contributionModeParam = { equalFixed: {} };
  } else if (args.contributionMode === "customFixed") {
    contributionModeParam = { customFixed: {} };
  } else {
    contributionModeParam = { percentOfTarget: {} };
  }

  const rawAmount = new BN(
    Math.floor(args.amountPerContributor * Math.pow(10, args.decimals))
  );
  const rawTargetAmount = new BN(
    Math.floor(args.targetAmount * Math.pow(10, args.decimals))
  );

  const contributorsParam = args.contributors.map((c) => ({
    wallet: c.wallet,
    requiredAmount: new BN(c.requiredAmount),
  }));

  const tx = await (program.methods as any)
    .createPot({
      seed: Array.from(args.seed),
      name: args.name,
      description: args.description,
      recipient: args.recipient,
      amountPerContributor: rawAmount,
      targetAmount: rawTargetAmount,
      contributionMode: contributionModeParam,
      contributors: contributorsParam,
      releaseMode: releaseModeParam,
      threshold: thresholdParam,
      kind: args.kind === 'fundraise' ? { fundraise: {} } : { contribution: {} },
      fundraiseMode: args.fundraiseMode === 'ruggable' ? { ruggable: {} } : { fixedLimit: {} },
    })
    .accounts({
      pot,
      creator,
      mint: args.mint,
      protocolConfig,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { tx, potAddress: pot.toBase58() };
}

export async function contribute(
  connection: Connection,
  wallet: AnchorWallet,
  contributor: PublicKey,
  potAddress: string,
  mintAddress: string,
  amount: number,
  decimals: number,
  treasuryAddress: string
) {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();
  const pot = new PublicKey(potAddress);
  const mint = new PublicKey(mintAddress);
  const treasury = new PublicKey(treasuryAddress);

  const contributorAta = getAssociatedTokenAddressSync(mint, contributor);
  const potVault = getAssociatedTokenAddressSync(mint, pot, true);
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, true);
  const rawAmount = new BN(Math.floor(amount * Math.pow(10, decimals)));

  const tx = await (program.methods as any)
    .contribute(rawAmount)
    .accounts({
      pot,
      protocolConfig,
      contributor,
      contributorTokenAccount: contributorAta,
      potVault,
      treasuryTokenAccount: treasuryAta,
      treasury,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { tx };
}

export async function fundraiseContribute(
  connection: Connection,
  wallet: AnchorWallet,
  contributor: PublicKey,
  potAddress: string,
  mintAddress: string,
  amount: number,
  decimals: number,
  treasuryAddress: string,
  recipientAddress: string
) {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();
  const pot = new PublicKey(potAddress);
  const mint = new PublicKey(mintAddress);
  const treasury = new PublicKey(treasuryAddress);
  const recipient = new PublicKey(recipientAddress);

  const contributorAta = getAssociatedTokenAddressSync(mint, contributor);
  const potVault = getAssociatedTokenAddressSync(mint, pot, true);
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, true);
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient);
  const rawAmount = new BN(Math.floor(amount * Math.pow(10, decimals)));

  const tx = await (program.methods as any)
    .fundraiseContribute(rawAmount)
    .accounts({
      pot,
      protocolConfig,
      contributor,
      contributorTokenAccount: contributorAta,
      potVault,
      treasuryTokenAccount: treasuryAta,
      treasury,
      recipientTokenAccount: recipientAta,
      recipient,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { tx };
}

export async function release(
  connection: Connection,
  wallet: AnchorWallet,
  caller: PublicKey,
  potAddress: string,
  mintAddress: string,
  recipientAddress: string
) {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();
  const pot = new PublicKey(potAddress);
  const mint = new PublicKey(mintAddress);
  const recipient = new PublicKey(recipientAddress);

  const potVault = getAssociatedTokenAddressSync(mint, pot, true);
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient);

  const tx = await (program.methods as any)
    .release()
    .accounts({
      pot,
      protocolConfig,
      caller,
      potVault,
      recipientTokenAccount: recipientAta,
      recipient,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { tx };
}

export async function cancelPot(
  connection: Connection,
  wallet: AnchorWallet,
  creator: PublicKey,
  potAddress: string
) {
  const program = getProgram(connection, wallet);
  const tx = await (program.methods as any)
    .cancel()
    .accounts({ pot: new PublicKey(potAddress), creator })
    .rpc();
  return { tx };
}

export async function refundContributor(
  connection: Connection,
  wallet: AnchorWallet,
  contributor: PublicKey,
  potAddress: string,
  mintAddress: string
) {
  const program = getProgram(connection, wallet);
  const pot = new PublicKey(potAddress);
  const mint = new PublicKey(mintAddress);
  const potVault = getAssociatedTokenAddressSync(mint, pot, true);
  const contributorAta = getAssociatedTokenAddressSync(mint, contributor);

  const tx = await (program.methods as any)
    .refundContributor()
    .accounts({
      pot,
      contributor,
      potVault,
      contributorTokenAccount: contributorAta,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { tx };
}
