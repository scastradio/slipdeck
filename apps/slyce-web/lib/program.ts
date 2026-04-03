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
import IDL from "./slyce.json";
import { PROGRAM_ID, SPLIT_SEED, PROTOCOL_CONFIG_SEED } from "./constants";

export type DistributionMode = "percentage" | "fixed" | "equal";

export function getProgram(connection: Connection, wallet: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(IDL as any, provider);
}

// ─── PDAs ──────────────────────────────────────────────────────────────────

export function getProtocolConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROTOCOL_CONFIG_SEED], PROGRAM_ID);
}

export function getSplitPDA(
  creator: PublicKey,
  seed: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SPLIT_SEED, creator.toBuffer(), seed],
    PROGRAM_ID
  );
}

// ─── Fetch all splits ────────────────────────────────────────────────────────

export interface OnChainSplit {
  address: string;
  creator: string;
  mint: string;
  name: string;
  description: string;
  recipients: { address: string; share_value: number; label: string }[];
  distributionMode: DistributionMode;
  autoDistribute: boolean;
  locked: boolean;
  totalDeposited: string; // u64 as string
  totalDistributed: string;
  bump: number;
  createdAt: number;
  seed: number[];
}

function parseDistributionMode(m: any): DistributionMode {
  if (m.percentage !== undefined) return "percentage";
  if (m.fixed !== undefined) return "fixed";
  return "equal";
}

function mapSplit(address: string, a: any): OnChainSplit {
  return {
    address,
    creator: a.creator.toBase58(),
    mint: a.mint.toBase58(),
    name: a.name,
    description: a.description,
    recipients: a.recipients.map((r: any) => ({
      address: r.address.toBase58(),
      share_value: r.shareValue.toNumber(),
      label: r.label,
    })),
    distributionMode: parseDistributionMode(a.distributionMode),
    autoDistribute: a.autoDistribute,
    locked: a.locked,
    totalDeposited: a.totalDeposited.toString(),
    totalDistributed: a.totalDistributed.toString(),
    bump: a.bump,
    createdAt: a.createdAt.toNumber(),
    seed: a.seed,
  };
}

export async function fetchAllSplits(
  connection: Connection,
  wallet: AnchorWallet
): Promise<OnChainSplit[]> {
  const program = getProgram(connection, wallet);
  try {
    const accounts = await (program.account as any).split.all();
    return accounts.map((a: any) => mapSplit(a.publicKey.toBase58(), a.account));
  } catch {
    return [];
  }
}

export async function fetchSplit(
  connection: Connection,
  wallet: AnchorWallet,
  address: string
): Promise<OnChainSplit | null> {
  const program = getProgram(connection, wallet);
  try {
    const pk = new PublicKey(address);
    const a = await (program.account as any).split.fetch(pk);
    return mapSplit(address, a);
  } catch {
    return null;
  }
}

// ─── Vault balance ────────────────────────────────────────────────────────────

export async function fetchVaultBalance(
  connection: Connection,
  splitAddress: string,
  mintAddress: string
): Promise<number> {
  try {
    const split = new PublicKey(splitAddress);
    const mint = new PublicKey(mintAddress);
    const vault = getAssociatedTokenAddressSync(mint, split, true);
    const info = await connection.getTokenAccountBalance(vault);
    return info.value.uiAmount ?? 0;
}
  catch {
    return 0;
  }
}

// ─── Create split ─────────────────────────────────────────────────────────────

function toDistributionModeParam(mode: DistributionMode) {
  if (mode === "percentage") return { percentage: {} };
  if (mode === "fixed") return { fixed: {} };
  return { equal: {} };
}

export async function createSplit(
  connection: Connection,
  wallet: AnchorWallet,
  creator: PublicKey,
  args: {
    seed: Uint8Array;
    name: string;
    description: string;
    mint: PublicKey;
    recipients: { address: PublicKey; share_value: number; label: string }[];
    distributionMode: DistributionMode;
    autoDistribute: boolean;
  }
) {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();
  const [split] = getSplitPDA(creator, args.seed);

  const tx = await (program.methods as any)
    .createSplit({
      seed: Array.from(args.seed),
      recipients: args.recipients.map((r) => ({
        address: r.address,
        shareValue: new BN(r.share_value),
        label: r.label,
      })),
      distributionMode: toDistributionModeParam(args.distributionMode),
      autoDistribute: args.autoDistribute,
      name: args.name,
      description: args.description,
    })
    .accounts({
      split,
      creator,
      mint: args.mint,
      protocolConfig,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { tx, splitAddress: split.toBase58() };
}

// ─── Deposit ─────────────────────────────────────────────────────────────────

export async function deposit(
  connection: Connection,
  wallet: AnchorWallet,
  depositor: PublicKey,
  splitAddress: string,
  mintAddress: string,
  amount: number, // human-readable, e.g. 10.5 USDC
  decimals: number
) {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();

  const split = new PublicKey(splitAddress);
  const mint = new PublicKey(mintAddress);

  // Fetch protocol config to get treasury
  const configAccount = await (program.account as any).protocolConfig.fetch(
    protocolConfig
  );
  const treasury = configAccount.treasury as PublicKey;

  const depositorAta = getAssociatedTokenAddressSync(mint, depositor);
  const splitVault = getAssociatedTokenAddressSync(mint, split, true);
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, true);

  const rawAmount = new BN(Math.floor(amount * Math.pow(10, decimals)));

  const tx = await (program.methods as any)
    .deposit(rawAmount)
    .accounts({
      split,
      protocolConfig,
      depositor,
      depositorTokenAccount: depositorAta,
      splitVault,
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

// ─── Claim ────────────────────────────────────────────────────────────────────

export async function claim(
  connection: Connection,
  wallet: AnchorWallet,
  recipient: PublicKey,
  splitAddress: string,
  mintAddress: string
) {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();

  const split = new PublicKey(splitAddress);
  const mint = new PublicKey(mintAddress);

  const splitVault = getAssociatedTokenAddressSync(mint, split, true);
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient);

  const tx = await (program.methods as any)
    .claim()
    .accounts({
      split,
      protocolConfig,
      splitVault,
      recipient,
      recipientTokenAccount: recipientAta,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { tx };
}
