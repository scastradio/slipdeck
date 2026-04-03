import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("AP1zffBjNji81oWozs96YDQBnqxYhNAjyqLHn3i2XYpC");
export const POT_SEED = Buffer.from("pot");
export const PROTOCOL_CONFIG_SEED = Buffer.from("ante_config");
export const MAX_CONTRIBUTORS = 10;

export const SUPPORTED_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether",
    mint: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS",
    decimals: 6,
  },
];
