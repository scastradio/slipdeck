import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("8PSSP4AxGti8bo5ou2Pe56Pkv79q7quGcJFJ9e5AaJwk");
export const PROTOCOL_CONFIG_SEED = Buffer.from("gauntlet_config");
export const GAME_SEED = Buffer.from("game");
export const PLAYER_SEED = Buffer.from("player");
export const VAULT_SEED = Buffer.from("vault");

export const PROTOCOL_FEE_BPS = 100; // 1%
export const BASIS_POINTS_DENOM = 10_000;

// Default devnet tokens (any SPL mint accepted for entry fee)
export const KNOWN_TOKENS = [
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9, native: true },
  { symbol: "USDC", mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
  { symbol: "USDT", mint: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS", decimals: 6 },
];

export const SUPER_ADMIN = "7Qs8U5PivdzuEmspnU3zmtAbL4BZsWT2jnpHi8E75DzJ";
