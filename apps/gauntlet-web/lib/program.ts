// @ts-nocheck
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PROGRAM_ID, PROTOCOL_CONFIG_SEED, GAME_SEED, PLAYER_SEED, VAULT_SEED } from "./constants";
import idl from "./gauntlet.json";

export interface OnChainGame {
  address: string;
  gameId: string;
  admin: string;
  mint: string;
  name: string;
  theme: string;
  deathMessages: string[];
  entryFee: string;
  winnerSplits: number[];
  adminProfitBps: number;
  maxPlayers: number;
  mutable: boolean;
  autoPay: boolean;
  status: "pending" | "active" | "ended" | "cancelled";
  playerCount: number;
  eliminatedCount: number;
  totalPot: string;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  feed: FeedEvent[];
}

export interface FeedEvent {
  message: string;
  timestamp: number;
  kind: "gameStart" | "elimination" | "gameEnd" | "payout" | "systemMessage";
}

export interface OnChainPlayer {
  address: string;
  game: string;
  player: string;
  entryNumber: number;
  alive: boolean;
  claimed: boolean;
  enteredAt: number;
  eliminatedAt: number | null;
  deathMessage: string | null;
  finalRank: number | null;
}

export function getProgram(connection: Connection, wallet: any): Program {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idl as any, provider);
}

export function getProtocolConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROTOCOL_CONFIG_SEED], PROGRAM_ID);
}

export function getGamePDA(gameId: bigint): [PublicKey, number] {
  const idBytes = Buffer.alloc(8);
  idBytes.writeBigUInt64LE(gameId);
  return PublicKey.findProgramAddressSync([GAME_SEED, idBytes], PROGRAM_ID);
}

export function getPlayerPDA(gameKey: PublicKey, playerKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PLAYER_SEED, gameKey.toBuffer(), playerKey.toBuffer()],
    PROGRAM_ID
  );
}

export function getVaultPDA(gameId: bigint): [PublicKey, number] {
  const idBytes = Buffer.alloc(8);
  idBytes.writeBigUInt64LE(gameId);
  return PublicKey.findProgramAddressSync([VAULT_SEED, idBytes], PROGRAM_ID);
}

function parseStatus(raw: any): OnChainGame["status"] {
  const k = Object.keys(raw)[0].toLowerCase();
  return k as OnChainGame["status"];
}

function parseFeedKind(raw: any): FeedEvent["kind"] {
  const k = Object.keys(raw)[0];
  const map: Record<string, FeedEvent["kind"]> = {
    gameStart: "gameStart",
    elimination: "elimination",
    gameEnd: "gameEnd",
    payout: "payout",
    systemMessage: "systemMessage",
  };
  return map[k] ?? "systemMessage";
}

function parseGame(address: PublicKey, acc: any): OnChainGame {
  return {
    address: address.toBase58(),
    gameId: acc.gameId.toString(),
    admin: acc.admin.toBase58(),
    mint: acc.mint.toBase58(),
    name: acc.name,
    theme: acc.theme,
    deathMessages: acc.deathMessages,
    entryFee: acc.entryFee.toString(),
    winnerSplits: acc.winnerSplits.map((s: any) => Number(s)),
    adminProfitBps: Number(acc.adminProfitBps),
    maxPlayers: acc.maxPlayers,
    mutable: acc.mutable,
    autoPay: acc.autoPay,
    status: parseStatus(acc.status),
    playerCount: acc.playerCount,
    eliminatedCount: acc.eliminatedCount,
    totalPot: acc.totalPot.toString(),
    createdAt: acc.createdAt.toNumber(),
    startedAt: acc.startedAt ? acc.startedAt.toNumber() : null,
    endedAt: acc.endedAt ? acc.endedAt.toNumber() : null,
    feed: acc.feed.map((f: any) => ({
      message: f.message,
      timestamp: f.timestamp.toNumber(),
      kind: parseFeedKind(f.kind),
    })),
  };
}

function parsePlayer(address: PublicKey, acc: any): OnChainPlayer {
  return {
    address: address.toBase58(),
    game: acc.game.toBase58(),
    player: acc.player.toBase58(),
    entryNumber: acc.entryNumber,
    alive: acc.alive,
    claimed: acc.claimed,
    enteredAt: acc.enteredAt.toNumber(),
    eliminatedAt: acc.eliminatedAt ? acc.eliminatedAt.toNumber() : null,
    deathMessage: acc.deathMessage ?? null,
    finalRank: acc.finalRank ?? null,
  };
}

export async function fetchAllGames(connection: Connection, wallet: any): Promise<OnChainGame[]> {
  const program = getProgram(connection, wallet);
  const accounts = await program.account.gameAccount.all();
  return accounts.map((a) => parseGame(a.publicKey, a.account))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchGame(connection: Connection, wallet: any, address: string): Promise<OnChainGame | null> {
  try {
    const program = getProgram(connection, wallet);
    const pubkey = new PublicKey(address);
    const acc = await program.account.gameAccount.fetch(pubkey);
    return parseGame(pubkey, acc);
  } catch { return null; }
}

export async function fetchPlayersForGame(connection: Connection, wallet: any, gameKey: string): Promise<OnChainPlayer[]> {
  try {
    const program = getProgram(connection, wallet);
    const accounts = await program.account.playerAccount.all([
      { memcmp: { offset: 8, bytes: gameKey } }
    ]);
    return accounts.map((a) => parsePlayer(a.publicKey, a.account))
      .sort((a, b) => a.entryNumber - b.entryNumber);
  } catch { return []; }
}

export async function fetchPlayerAccount(connection: Connection, wallet: any, address: string): Promise<OnChainPlayer | null> {
  try {
    const program = getProgram(connection, wallet);
    const pubkey = new PublicKey(address);
    const acc = await program.account.playerAccount.fetch(pubkey);
    return parsePlayer(pubkey, acc);
  } catch { return null; }
}

export async function fetchMintInfo(connection: Connection, mintAddress: string): Promise<{ decimals: number } | null> {
  try {
    const mint = new PublicKey(mintAddress);
    const info = await connection.getParsedAccountInfo(mint);
    if (!info.value) return null;
    const data = (info.value.data as any).parsed?.info;
    if (!data) return null;
    return { decimals: data.decimals };
  } catch { return null; }
}
