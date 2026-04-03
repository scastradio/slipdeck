// @ts-nocheck
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PROGRAM_ID, AIRDROP_SEED, PROTOCOL_CONFIG_SEED } from "./constants";
import idl from "./drop.json";

export interface OnChainAirdrop {
  address: string;
  creator: string;
  mint: string;
  mode: "push" | "claim";
  status: "pending" | "active" | "complete" | "drained";
  recipients: { wallet: string; amount: string; claimed: boolean }[];
  totalTokens: string;
  tokensDeposited: string;
  name: string;
  createdAt: number;
  seed: number[];
  bump: number;
}

export function getProgram(connection: Connection, wallet: any): Program {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as any, provider);
}

export function getProtocolConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("drop_config")],
    PROGRAM_ID
  );
}

export function getAirdropPDA(creator: PublicKey, seed: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("airdrop"), creator.toBuffer(), Buffer.from(seed)],
    PROGRAM_ID
  );
}

function parseAirdropAccount(address: PublicKey, account: any): OnChainAirdrop {
  const modeKey = Object.keys(account.mode)[0];
  const statusKey = Object.keys(account.status)[0];

  return {
    address: address.toBase58(),
    creator: account.creator.toBase58(),
    mint: account.mint.toBase58(),
    mode: modeKey.toLowerCase() as "push" | "claim",
    status: statusKey.toLowerCase() as "pending" | "active" | "complete" | "drained",
    recipients: account.recipients.map((r: any) => ({
      wallet: r.wallet.toBase58(),
      amount: r.amount.toString(),
      claimed: r.claimed,
    })),
    totalTokens: account.totalTokens.toString(),
    tokensDeposited: account.tokensDeposited.toString(),
    name: account.name,
    createdAt: account.createdAt.toNumber(),
    seed: Array.from(account.seed),
    bump: account.bump,
  };
}

export async function fetchAllAirdrops(
  connection: Connection,
  wallet: any
): Promise<OnChainAirdrop[]> {
  const program = getProgram(connection, wallet);
  const accounts = await program.account.airdrop.all();
  return accounts.map((acc) => parseAirdropAccount(acc.publicKey, acc.account));
}

export async function fetchAirdrop(
  connection: Connection,
  wallet: any,
  address: string
): Promise<OnChainAirdrop | null> {
  try {
    const program = getProgram(connection, wallet);
    const pubkey = new PublicKey(address);
    const account = await program.account.airdrop.fetch(pubkey);
    return parseAirdropAccount(pubkey, account);
  } catch {
    return null;
  }
}

export async function fetchVaultBalance(
  connection: Connection,
  airdropAddress: string,
  mintAddress: string
): Promise<number> {
  try {
    const airdropPubkey = new PublicKey(airdropAddress);
    const mintPubkey = new PublicKey(mintAddress);
    const vault = await getAssociatedTokenAddress(mintPubkey, airdropPubkey, true);
    const balance = await connection.getTokenAccountBalance(vault);
    return balance.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

export async function createAirdrop(
  connection: Connection,
  wallet: any,
  creator: PublicKey,
  args: {
    name: string;
    mode: "push" | "claim";
    mint: string;
    recipients: { wallet: string; amount: bigint }[];
    seed: number[];
  }
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [airdropPDA] = getAirdropPDA(creator, args.seed);
  const [protocolConfigPDA] = getProtocolConfigPDA();
  const mintPubkey = new PublicKey(args.mint);

  const modeArg = args.mode === "push" ? { push: {} } : { claim: {} };

  const recipientParams = args.recipients.map((r) => ({
    wallet: new PublicKey(r.wallet),
    amount: new BN(r.amount.toString()),
  }));

  const tx = await program.methods
    .createAirdrop({
      seed: args.seed,
      name: args.name,
      mode: modeArg,
      recipients: recipientParams,
    })
    .accounts({
      airdrop: airdropPDA,
      creator,
      mint: mintPubkey,
      protocolConfig: protocolConfigPDA,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return airdropPDA.toBase58();
}

export async function fundAirdrop(
  connection: Connection,
  wallet: any,
  creator: PublicKey,
  airdropAddress: string,
  mintAddress: string,
  treasuryAddress: string
): Promise<string> {
  const program = getProgram(connection, wallet);
  const airdropPubkey = new PublicKey(airdropAddress);
  const mintPubkey = new PublicKey(mintAddress);
  const treasuryPubkey = new PublicKey(treasuryAddress);
  const [protocolConfigPDA] = getProtocolConfigPDA();

  const creatorTokenAccount = await getAssociatedTokenAddress(mintPubkey, creator);
  const airdropVault = await getAssociatedTokenAddress(mintPubkey, airdropPubkey, true);

  const tx = await program.methods
    .fundAirdrop()
    .accounts({
      airdrop: airdropPubkey,
      protocolConfig: protocolConfigPDA,
      creator,
      creatorTokenAccount,
      airdropVault,
      treasury: treasuryPubkey,
      mint: mintPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return tx;
}

export async function executePush(
  connection: Connection,
  wallet: any,
  executor: PublicKey,
  airdropAddress: string,
  mintAddress: string,
  recipientIndex: number,
  recipientWallet: string
): Promise<string> {
  const program = getProgram(connection, wallet);
  const airdropPubkey = new PublicKey(airdropAddress);
  const mintPubkey = new PublicKey(mintAddress);
  const recipientPubkey = new PublicKey(recipientWallet);
  const [protocolConfigPDA] = getProtocolConfigPDA();

  const airdropVault = await getAssociatedTokenAddress(mintPubkey, airdropPubkey, true);
  const recipientTokenAccount = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

  const tx = await program.methods
    .executePush(recipientIndex)
    .accounts({
      airdrop: airdropPubkey,
      protocolConfig: protocolConfigPDA,
      executor,
      airdropVault,
      recipientTokenAccount,
      recipient: recipientPubkey,
      mint: mintPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return tx;
}

export async function claimAirdrop(
  connection: Connection,
  wallet: any,
  recipient: PublicKey,
  airdropAddress: string,
  mintAddress: string
): Promise<string> {
  const program = getProgram(connection, wallet);
  const airdropPubkey = new PublicKey(airdropAddress);
  const mintPubkey = new PublicKey(mintAddress);
  const [protocolConfigPDA] = getProtocolConfigPDA();

  const airdropVault = await getAssociatedTokenAddress(mintPubkey, airdropPubkey, true);
  const recipientTokenAccount = await getAssociatedTokenAddress(mintPubkey, recipient);

  const tx = await program.methods
    .claim()
    .accounts({
      airdrop: airdropPubkey,
      protocolConfig: protocolConfigPDA,
      recipient,
      airdropVault,
      recipientTokenAccount,
      mint: mintPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return tx;
}

export async function resetRecipient(
  connection: Connection,
  wallet: AnchorWallet,
  authority: PublicKey,
  airdropAddress: string,
  recipientIndex: number
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [protocolConfig] = getProtocolConfigPDA();

  const tx = await (program.methods as any)
    .resetRecipient(recipientIndex)
    .accounts({
      airdrop: new PublicKey(airdropAddress),
      protocolConfig,
      authority,
    })
    .rpc();

  return tx;
}
