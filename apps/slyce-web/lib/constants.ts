import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("HjxvE9rkX8tx2AYKSSnzGKCkhz4aDcc45XpYMVKFE23a");

export const PROTOCOL_CONFIG_SEED = Buffer.from("protocol_config");
export const SPLIT_SEED = Buffer.from("split");

export const SUPPORTED_TOKENS = [
  {
    symbol: "SOL",
    name: "Wrapped SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // devnet
    decimals: 6,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  {
    symbol: "USDT",
    name: "USDT",
    mint: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS", // devnet
    decimals: 6,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
  },
  {
    symbol: "CUSTOM",
    name: "Custom SPL Token",
    mint: "",
    decimals: 0,
    logo: "",
  },
];

export const BASIS_POINTS = 10_000;
export const MAX_RECIPIENTS = 10;
