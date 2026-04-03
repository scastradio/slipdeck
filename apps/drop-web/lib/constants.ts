import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("5RVHbWKCiiF14eTXV6MZGbQ4EvYC83vvDPKbjVd6C37w");
export const AIRDROP_SEED = Buffer.from("airdrop");
export const PROTOCOL_CONFIG_SEED = Buffer.from("drop_config");
export const PROTOCOL_FEE_LAMPORTS_PER_WALLET = 1_000_000; // 0.001 SOL

// Well-known devnet tokens (suggestions only — any valid SPL mint is accepted)
export const KNOWN_TOKENS = [
  { symbol: "USDC", mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
  { symbol: "USDT", mint: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS", decimals: 6 },
];

export const BATCH_SIZE = 50; // max recipients per on-chain airdrop
