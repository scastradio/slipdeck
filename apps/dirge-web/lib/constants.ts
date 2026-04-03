import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("CAeLQYB1PFQGDq3iWAscG7rjPQJyRyjEMkxjwhuGbgKL");
export const SUPER_CONFIG_SEED = Buffer.from("dirge_config");
export const GAME_SEED = Buffer.from("dirge_game");
export const ENTRY_SEED = Buffer.from("dirge_entry");
export const PROTOCOL_FEE_BPS = 100;

export const KNOWN_TOKENS = [
  { symbol: "USDC", mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
  { symbol: "USDT", mint: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS", decimals: 6 },
];
