// @ts-nocheck
import { Connection } from "@solana/web3.js";
import { getProgram, getSuperConfigPDA } from "./program";

export async function fetchSuperConfig(connection: Connection, wallet: any) {
  const program = getProgram(connection, wallet);
  const [superConfig] = getSuperConfigPDA();
  return await program.account.superConfig.fetch(superConfig);
}
