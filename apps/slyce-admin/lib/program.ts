/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import IDL from "./slyce.json";

export const PROGRAM_ID = new PublicKey("HjxvE9rkX8tx2AYKSSnzGKCkhz4aDcc45XpYMVKFE23a");
export const PROTOCOL_CONFIG_SEED = Buffer.from("protocol_config");

export function getProgram(connection: Connection, wallet: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(IDL as any, provider);
}

export function getProtocolConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROTOCOL_CONFIG_SEED], PROGRAM_ID);
}

// ─── Protocol config ─────────────────────────────────────────────────────────

export interface ProtocolConfig {
  admin: string;
  treasury: string;
  feeBps: number;
  totalFeesCollected: string;
  totalVolume: string;
  paused: boolean;
  bump: number;
}

export async function fetchProtocolConfig(
  connection: Connection,
  wallet: AnchorWallet
): Promise<ProtocolConfig | null> {
  const program = getProgram(connection, wallet);
  const [pda] = getProtocolConfigPDA();
  try {
    const a = await (program.account as any).protocolConfig.fetch(pda);
    return {
      admin: a.admin.toBase58(),
      treasury: a.treasury.toBase58(),
      feeBps: a.feeBps.toNumber(),
      totalFeesCollected: a.totalFeesCollected.toString(),
      totalVolume: a.totalVolume.toString(),
      paused: a.paused,
      bump: a.bump,
    };
  } catch {
    return null;
  }
}

// ─── All splits ───────────────────────────────────────────────────────────────

export interface SplitSummary {
  address: string;
  creator: string;
  mint: string;
  name: string;
  locked: boolean;
  totalDeposited: string;
  totalDistributed: string;
  recipients: number;
  createdAt: number;
}

export async function fetchAllSplits(
  connection: Connection,
  wallet: AnchorWallet
): Promise<SplitSummary[]> {
  const program = getProgram(connection, wallet);
  try {
    const accounts = await (program.account as any).split.all();
    return accounts
      .map((a: any) => ({
        address: a.publicKey.toBase58(),
        creator: a.account.creator.toBase58(),
        mint: a.account.mint.toBase58(),
        name: a.account.name || "Unnamed",
        locked: a.account.locked,
        totalDeposited: a.account.totalDeposited.toString(),
        totalDistributed: a.account.totalDistributed.toString(),
        recipients: a.account.recipients.length,
        createdAt: a.account.createdAt.toNumber(),
      }))
      .sort((a: any, b: any) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// ─── Admin instructions ───────────────────────────────────────────────────────

export async function updateFee(
  connection: Connection,
  wallet: AnchorWallet,
  admin: PublicKey,
  newFeeBps: number
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();
  return (program.methods as any)
    .updateFee(new BN(newFeeBps))
    .accounts({ protocolConfig, admin })
    .rpc();
}

export async function setPaused(
  connection: Connection,
  wallet: AnchorWallet,
  admin: PublicKey,
  paused: boolean
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();
  return (program.methods as any)
    .setPaused(paused)
    .accounts({ protocolConfig, admin })
    .rpc();
}

export async function updateTreasury(
  connection: Connection,
  wallet: AnchorWallet,
  admin: PublicKey,
  newTreasury: PublicKey
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();
  return (program.methods as any)
    .updateTreasury()
    .accounts({ protocolConfig, admin, newTreasury })
    .rpc();
}

export async function adminRefund(
  connection: Connection,
  wallet: AnchorWallet,
  admin: PublicKey,
  splitAddress: string,
  mintAddress: string,
  creatorAddress: string
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();

  const split = new PublicKey(splitAddress);
  const mint = new PublicKey(mintAddress);
  const creator = new PublicKey(creatorAddress);

  const splitVault = getAssociatedTokenAddressSync(mint, split, true);
  const creatorAta = getAssociatedTokenAddressSync(mint, creator);

  return (program.methods as any)
    .adminRefund()
    .accounts({
      split,
      protocolConfig,
      admin,
      splitVault,
      creatorTokenAccount: creatorAta,
      creator,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
}

export async function closeSplit(
  connection: Connection,
  wallet: AnchorWallet,
  admin: PublicKey,
  splitAddress: string,
  mintAddress: string,
  treasuryAddress: string
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();

  const split = new PublicKey(splitAddress);
  const mint = new PublicKey(mintAddress);
  const treasury = new PublicKey(treasuryAddress);

  const splitVault = getAssociatedTokenAddressSync(mint, split, true);
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, true);

  return (program.methods as any)
    .closeSplit()
    .accounts({
      split,
      protocolConfig,
      admin,
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
}

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
  } catch {
    return 0;
  }
}
