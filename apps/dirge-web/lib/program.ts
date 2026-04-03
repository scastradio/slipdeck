// @ts-nocheck
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PROGRAM_ID, SUPER_CONFIG_SEED, GAME_SEED, ENTRY_SEED } from "./constants";
import idl from "./dirge.json";

export function getProgram(connection: Connection, wallet: any) {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idl as any, provider);
}

export function getSuperConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SUPER_CONFIG_SEED], PROGRAM_ID);
}

export function getGamePDA(creator: PublicKey, seed: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([GAME_SEED, creator.toBuffer(), seed], PROGRAM_ID);
}

export function getEntryPDA(game: PublicKey, player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ENTRY_SEED, game.toBuffer(), player.toBuffer()], PROGRAM_ID);
}

export async function fetchAllGames(connection: Connection, wallet: any) {
  const program = getProgram(connection, wallet);
  try {
    const games = await program.account.game.all();
    return games;
  } catch (e) {
    console.error("fetchAllGames error:", e);
    return [];
  }
}

export async function fetchGame(connection: Connection, wallet: any, gameAddress: string) {
  const program = getProgram(connection, wallet);
  const pubkey = new PublicKey(gameAddress);
  return await program.account.game.fetch(pubkey);
}

export async function fetchEntry(connection: Connection, wallet: any, entryAddress: string) {
  const program = getProgram(connection, wallet);
  const pubkey = new PublicKey(entryAddress);
  return await program.account.entry.fetch(pubkey);
}

export async function fetchGameEntries(connection: Connection, wallet: any, gameAddress: string) {
  const program = getProgram(connection, wallet);
  const gamePubkey = new PublicKey(gameAddress);
  const entries = await program.account.entry.all([
    {
      memcmp: {
        offset: 8, // discriminator
        bytes: gamePubkey.toBase58(),
      },
    },
  ]);
  return entries;
}

export async function createGame(
  connection: Connection,
  wallet: any,
  creator: PublicKey,
  params: {
    seed: Uint8Array;
    name: string;
    theme: string;
    entryFee: BN;
    entryMint: PublicKey;
    maxPlayers: number;
    winners: { place: number; basisPoints: number }[];
    mutability: "mutable" | "immutable";
    payoutMode: "auto" | "claim";
    intendedStart: BN;
    eliminationIntervalSeconds: BN;
  }
) {
  const program = getProgram(connection, wallet);
  const [superConfig] = getSuperConfigPDA();
  const [game] = getGamePDA(creator, params.seed);

  const winners = params.winners.map((w) => ({
    place: w.place,
    basisPoints: w.basisPoints,
  }));

  const mutability = params.mutability === "mutable" ? { mutable: {} } : { immutable: {} };
  const payoutMode = params.payoutMode === "auto" ? { auto: {} } : { claim: {} };

  return await program.methods
    .createGame({
      seed: Array.from(params.seed),
      name: params.name,
      theme: params.theme,
      entryFee: params.entryFee,
      entryMint: params.entryMint,
      maxPlayers: params.maxPlayers,
      winners,
      mutability,
      payoutMode,
      intendedStart: params.intendedStart,
      eliminationIntervalSeconds: params.eliminationIntervalSeconds,
    })
    .accounts({
      game,
      superConfig,
      creator,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
}

export async function enterGame(
  connection: Connection,
  wallet: any,
  player: PublicKey,
  gameAddress: string,
  mintAddress: string,
  treasuryAddress: string
) {
  const program = getProgram(connection, wallet);
  const [superConfig] = getSuperConfigPDA();
  const gamePubkey = new PublicKey(gameAddress);
  const mintPubkey = new PublicKey(mintAddress);
  const treasuryPubkey = new PublicKey(treasuryAddress);
  const [entry] = getEntryPDA(gamePubkey, player);

  const playerTokenAccount = getAssociatedTokenAddressSync(mintPubkey, player);
  const gameVault = getAssociatedTokenAddressSync(mintPubkey, gamePubkey, true);
  const treasuryTokenAccount = getAssociatedTokenAddressSync(mintPubkey, treasuryPubkey);

  return await program.methods
    .enterGame()
    .accounts({
      game: gamePubkey,
      superConfig,
      entry,
      player,
      playerTokenAccount,
      gameVault,
      treasuryTokenAccount,
      treasury: treasuryPubkey,
      mint: mintPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
}

export async function startGame(
  connection: Connection,
  wallet: any,
  creator: PublicKey,
  gameAddress: string
) {
  const program = getProgram(connection, wallet);
  const [superConfig] = getSuperConfigPDA();
  const gamePubkey = new PublicKey(gameAddress);

  return await program.methods
    .startGame()
    .accounts({
      game: gamePubkey,
      superConfig,
      creator,
    })
    .rpc();
}

export async function eliminateNext(
  connection: Connection,
  wallet: any,
  cranker: PublicKey,
  gameAddress: string,
  victimEntryAddress: string
) {
  const program = getProgram(connection, wallet);
  const [superConfig] = getSuperConfigPDA();
  const gamePubkey = new PublicKey(gameAddress);
  const victimEntry = new PublicKey(victimEntryAddress);
  const SLOT_HASHES_ID = new PublicKey("SysvarS1otHashes111111111111111111111111111");

  return await program.methods
    .eliminateNext()
    .accounts({
      game: gamePubkey,
      superConfig,
      victimEntry,
      recentSlothashes: SLOT_HASHES_ID,
      cranker,
    })
    .rpc();
}

export async function claimPrize(
  connection: Connection,
  wallet: any,
  winner: PublicKey,
  gameAddress: string,
  mintAddress: string,
  winnerPlace: number
) {
  const program = getProgram(connection, wallet);
  const [superConfig] = getSuperConfigPDA();
  const gamePubkey = new PublicKey(gameAddress);
  const mintPubkey = new PublicKey(mintAddress);
  const [entry] = getEntryPDA(gamePubkey, winner);

  const gameVault = getAssociatedTokenAddressSync(mintPubkey, gamePubkey, true);
  const winnerTokenAccount = getAssociatedTokenAddressSync(mintPubkey, winner);

  return await program.methods
    .claimPrize(winnerPlace)
    .accounts({
      game: gamePubkey,
      superConfig,
      entry,
      winner,
      gameVault,
      winnerTokenAccount,
      mint: mintPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
}

export function formatAmount(lamports: BN | number, decimals: number = 6): string {
  const n = typeof lamports === "number" ? lamports : lamports.toNumber();
  return (n / Math.pow(10, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function shortAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function gameStatusLabel(status: any): string {
  if (!status) return "UNKNOWN";
  if (status.open !== undefined) return "OPEN";
  if (status.active !== undefined) return "LIVE";
  if (status.ended !== undefined) return "ENDED";
  if (status.closed !== undefined) return "CLOSED";
  return "UNKNOWN";
}

export function entryStatusLabel(status: any): string {
  if (!status) return "UNKNOWN";
  if (status.alive !== undefined) return "ALIVE";
  if (status.eliminated !== undefined) return "ELIMINATED";
  return "UNKNOWN";
}
