import { ethers, Wallet } from "ethers";
import { getChainConfig } from "./chains";

/**
 * Monad testnet configuration.
 *
 * Key Monad differences from Ethereum:
 * - Charges on gas_limit, NOT gas used (set tight limits!)
 * - Native transfer gas is always 21,000
 * - Minimum base fee: 100 gwei
 * - 10 MON reserve balance required per EOA
 * - 400ms block time, 800ms finality
 */
export const MONAD_CONFIG = getChainConfig(10143)!;

export interface TxParams {
  to: string;
  value: string; // in MON (e.g., "0.01")
  nonce: number;
  chainId?: number;
  gasLimit?: number;
  maxFeePerGas?: string; // in gwei
  maxPriorityFeePerGas?: string; // in gwei
}

/**
 * Sign a Monad transaction offline.
 * This function needs NO internet. Just a private key and tx params.
 * Returns the serialized signed transaction (hex string starting with 0x).
 *
 * NOTE: On Monad, gas_limit directly determines cost. We hardcode 21000
 * for native transfers since this is always correct and minimizes user cost.
 */
export async function signTransaction(
  params: TxParams,
  privateKey: string,
): Promise<string> {
  const wallet = new Wallet(privateKey);

  const chainId = params.chainId ?? MONAD_CONFIG.chainId;
  if (!getChainConfig(chainId)) throw new Error(`Unsupported chain: ${chainId}`);

  const tx = {
    to: params.to,
    value: ethers.parseEther(params.value),
    chainId,
    nonce: params.nonce,
    // Hardcode 21000 for native transfers — Monad charges on gas_limit!
    gasLimit: params.gasLimit || 21000,
    // Monad testnet base fee is ~100 gwei. Set maxFeePerGas high enough.
    maxFeePerGas: ethers.parseUnits(params.maxFeePerGas || "150", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits(
      params.maxPriorityFeePerGas || "2",
      "gwei",
    ),
    type: 2,
  };

  return await wallet.signTransaction(tx);
}

/**
 * Broadcast a signed transaction to Monad testnet.
 * Requires internet. Used by the Relay device.
 */
export async function broadcastTransaction(
  signedTx: string,
  chainId: number = MONAD_CONFIG.chainId,
): Promise<string> {
  const chain = getChainConfig(chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const response = await provider.broadcastTransaction(signedTx);
  return response.hash;
}

/**
 * Get the current nonce for an address.
 */
export async function getNonce(
  address: string,
  chainId: number = MONAD_CONFIG.chainId,
): Promise<number> {
  const chain = getChainConfig(chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  return await provider.getTransactionCount(address);
}

/**
 * Get wallet address from a private key (no internet needed).
 */
export function getAddress(privateKey: string): string {
  return new Wallet(privateKey).address;
}

/**
 * Get balance of an address.
 */
export async function getBalance(
  address: string,
  chainId: number = MONAD_CONFIG.chainId,
): Promise<string> {
  const chain = getChainConfig(chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export async function getFeeData(
  chainId: number = MONAD_CONFIG.chainId,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const chain = getChainConfig(chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  if (maxFeePerGas === null) throw new Error("RPC did not return fee data");

  return {
    maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 0n,
  };
}

export interface NativeTransferExpectation {
  sender: string;
  recipient: string;
  chainId: number;
  value: bigint;
  nonce: number;
  gasLimit: bigint;
  maxPriorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
}

/**
 * Validate a signed native transfer against the receiver's payment request.
 * This performs no network calls and rejects calldata so the receiver cannot
 * accidentally broadcast an arbitrary contract invocation.
 */
export async function validateSignedNativeTransfer(
  signedTx: string,
  expected: NativeTransferExpectation,
): Promise<ethers.Transaction> {
  const chain = getChainConfig(expected.chainId);
  if (!chain) throw new Error(`Unsupported chain: ${expected.chainId}`);

  const tx = ethers.Transaction.from(signedTx);
  if (tx.type !== 2) throw new Error("Only EIP-1559 transactions are supported");
  if (!tx.from) throw new Error("Signed transaction has no recoverable sender");
  if (tx.from.toLowerCase() !== expected.sender.toLowerCase()) {
    throw new Error("Sender mismatch");
  }
  if (tx.chainId !== BigInt(expected.chainId)) throw new Error("Chain ID mismatch");
  if (tx.to?.toLowerCase() !== expected.recipient.toLowerCase()) {
    throw new Error("Recipient mismatch");
  }
  if (tx.value !== expected.value) throw new Error("Value mismatch");
  if (tx.nonce !== expected.nonce) throw new Error("Nonce mismatch");
  if (tx.gasLimit !== expected.gasLimit) throw new Error("Gas limit mismatch");
  if (tx.gasLimit > BigInt(chain.gasLimitCap)) {
    throw new Error("Gas limit exceeds policy ceiling");
  }
  if (tx.data !== "0x") throw new Error("Native transfer contains calldata");
  if (expected.maxPriorityFeePerGas !== undefined && tx.maxPriorityFeePerGas !== expected.maxPriorityFeePerGas) {
    throw new Error("Priority fee mismatch");
  }
  if (expected.maxFeePerGas !== undefined && tx.maxFeePerGas !== expected.maxFeePerGas) {
    throw new Error("Max fee mismatch");
  }

  return tx;
}
