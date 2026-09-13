import { ethers } from "ethers";
import { getChainConfig } from "./chains";
import {
  ARC_CANONICAL_USDC,
  ARC_CHAIN_ID,
  buildReceiveAuthorizationTypedData,
  recoverReceiveAuthorizationSigner,
} from "./eip3009";

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

export interface Erc20TransferExpectation {
  sender: string;
  tokenContract: string;
  tokenRecipient: string;
  tokenAmount: bigint;
  chainId: number;
  nonce: number;
  gasLimit: bigint;
  maxPriorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
}

export async function validateSignedErc20Transfer(
  signedTx: string,
  expected: Erc20TransferExpectation,
): Promise<ethers.Transaction> {
  const chain = getChainConfig(expected.chainId);
  if (!chain) throw new Error(`Unsupported chain: ${expected.chainId}`);

  const tx = ethers.Transaction.from(signedTx);
  if (tx.type !== 2) throw new Error("Only EIP-1559 transactions are supported");
  if (!tx.from || tx.from.toLowerCase() !== expected.sender.toLowerCase()) {
    throw new Error("Sender mismatch");
  }
  if (tx.chainId !== BigInt(expected.chainId)) throw new Error("Chain ID mismatch");
  if (tx.to?.toLowerCase() !== expected.tokenContract.toLowerCase()) {
    throw new Error("Token contract mismatch");
  }
  if (tx.value !== 0n) throw new Error("ERC-20 transaction must not transfer native value");
  if (tx.nonce !== expected.nonce) throw new Error("Nonce mismatch");
  if (tx.gasLimit !== expected.gasLimit) throw new Error("Gas limit mismatch");
  if (tx.gasLimit > 200000n) throw new Error("ERC-20 gas limit exceeds policy ceiling");

  const data = ethers.getBytes(tx.data);
  if (data.length !== 68 || ethers.hexlify(data.slice(0, 4)) !== "0xa9059cbb") {
    throw new Error("Unsupported ERC-20 selector; only transfer is allowed");
  }

  const encodedRecipient = ethers.getAddress(ethers.hexlify(data.slice(16, 36)));
  if (encodedRecipient.toLowerCase() !== expected.tokenRecipient.toLowerCase()) {
    throw new Error("Token recipient mismatch");
  }

  let encodedAmount = 0n;
  for (const byte of data.slice(36, 68)) encodedAmount = (encodedAmount << 8n) | BigInt(byte);
  if (encodedAmount !== expected.tokenAmount) throw new Error("Token amount mismatch");

  if (expected.maxPriorityFeePerGas !== undefined && tx.maxPriorityFeePerGas !== expected.maxPriorityFeePerGas) {
    throw new Error("Priority fee mismatch");
  }
  if (expected.maxFeePerGas !== undefined && tx.maxFeePerGas !== expected.maxFeePerGas) {
    throw new Error("Max fee mismatch");
  }

  return tx;
}

export interface ArcAuthorizationExpectation {
  expectedAuthorizer?: string;
  expectedRecipient: string;
  expectedValue: bigint;
  chainId?: number;
  verifyingContract?: string;
  maxValidBefore?: bigint;
}

export function validateSignedReceiveAuthorization(
  auth: {
    authorizer: string;
    recipient: string;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: string;
    v: number;
    r: string;
    s: string;
  },
  expected: ArcAuthorizationExpectation,
  currentTimestamp = Math.floor(Date.now() / 1000),
): { authorizer: string; recipient: string; value: bigint; nonce: string } {
  if (auth.recipient.toLowerCase() !== expected.expectedRecipient.toLowerCase()) {
    throw new Error("Authorization recipient mismatch");
  }
  if (auth.value !== expected.expectedValue) throw new Error("Authorization amount mismatch");
  if (auth.validAfter > BigInt(currentTimestamp)) throw new Error("Authorization is not yet valid");
  if (auth.validBefore <= BigInt(currentTimestamp)) throw new Error("Authorization is expired");
  if (expected.maxValidBefore !== undefined && auth.validBefore > expected.maxValidBefore) {
    throw new Error("Authorization expiry exceeds request TTL");
  }
  if ((expected.chainId ?? ARC_CHAIN_ID) !== ARC_CHAIN_ID) throw new Error("Unsupported Arc chain ID");
  if ((expected.verifyingContract ?? ARC_CANONICAL_USDC).toLowerCase() !== ARC_CANONICAL_USDC.toLowerCase()) {
    throw new Error("Unsupported Arc token contract");
  }

  const typedData = buildReceiveAuthorizationTypedData({
    from: auth.authorizer,
    to: auth.recipient,
    value: auth.value,
    validAfter: auth.validAfter,
    validBefore: auth.validBefore,
    nonce: auth.nonce,
  });
  const signature = ethers.Signature.from({ v: auth.v, r: auth.r, s: auth.s }).serialized;
  const recovered = recoverReceiveAuthorizationSigner(typedData.domain, typedData.message, signature);
  if (expected.expectedAuthorizer !== undefined && recovered.toLowerCase() !== expected.expectedAuthorizer.toLowerCase()) {
    throw new Error("Authorization signer mismatch");
  }
  if (recovered.toLowerCase() !== auth.authorizer.toLowerCase()) {
    throw new Error("Authorization authorizer mismatch");
  }

  return { authorizer: recovered, recipient: auth.recipient, value: auth.value, nonce: auth.nonce };
}

export const ARC_USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

function arcRpcUrl(): string {
  if (typeof window !== "undefined") return new URL("/api/arc-rpc", window.location.href).toString();
  return "https://rpc.testnet.arc.io";
}

export async function getArcUsdcBalance(address: string): Promise<string> {
  const provider = new ethers.JsonRpcProvider(arcRpcUrl());
  const token = new ethers.Contract(ARC_CANONICAL_USDC, ARC_USDC_ABI, provider);
  return ethers.formatUnits(await token.balanceOf(address), 6);
}

export async function getArcAuthorizationState(authorizer: string, nonce: string): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(arcRpcUrl());
  const token = new ethers.Contract(ARC_CANONICAL_USDC, ARC_USDC_ABI, provider);
  return token.authorizationState(authorizer, nonce);
}
