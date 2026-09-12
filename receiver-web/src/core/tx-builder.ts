import { ethers } from "ethers";
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

export const ARC_USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
  "function authorizationState(address authorizer, bytes32 nonce) external view returns (bool)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

export async function getArcUsdcBalance(
  address: string,
  chainId: number = 5042002,
): Promise<string> {
  const chain = getChainConfig(chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const usdcContract = new ethers.Contract("0x3600000000000000000000000000000000000000", ARC_USDC_ABI, provider);
  const rawBalance: bigint = await usdcContract.balanceOf(address);
  return ethers.formatUnits(rawBalance, 6);
}

export async function getArcAuthorizationState(
  authorizer: string,
  nonce: string,
  chainId: number = 5042002,
): Promise<boolean> {
  const chain = getChainConfig(chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const usdcContract = new ethers.Contract("0x3600000000000000000000000000000000000000", ARC_USDC_ABI, provider);
  return await usdcContract.authorizationState(authorizer, nonce);
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
  currentTimestamp: number = Math.floor(Date.now() / 1000),
): { authorizer: string; recipient: string; value: bigint; nonce: string } {
  const chainId = expected.chainId ?? 5042002;
  const verifyingContract = expected.verifyingContract ?? "0x3600000000000000000000000000000000000000";

  const domain = {
    name: "USDC",
    version: "2",
    chainId,
    verifyingContract: ethers.getAddress(verifyingContract),
  };

  const message = {
    from: ethers.getAddress(auth.authorizer),
    to: ethers.getAddress(auth.recipient),
    value: auth.value,
    validAfter: auth.validAfter,
    validBefore: auth.validBefore,
    nonce: auth.nonce,
  };

  if (message.to.toLowerCase() !== expected.expectedRecipient.toLowerCase()) {
    throw new Error("Recipient mismatch");
  }
  if (message.value !== expected.expectedValue) {
    throw new Error("Value mismatch");
  }
  if (BigInt(currentTimestamp) > message.validBefore) {
    throw new Error("Authorization expired");
  }
  if (BigInt(currentTimestamp) < message.validAfter) {
    throw new Error("Authorization not yet valid");
  }

  // Recover authorizer from EIP-712 typed data
  const types = {
    ReceiveWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const digest = ethers.TypedDataEncoder.hash(domain, types, message);
  const signature = ethers.Signature.from({
    v: auth.v,
    r: auth.r,
    s: auth.s,
  });

  const recovered = ethers.recoverAddress(digest, signature);
  if (recovered.toLowerCase() !== message.from.toLowerCase()) {
    throw new Error("Signer recovery failed");
  }

  if (expected.expectedAuthorizer && recovered.toLowerCase() !== expected.expectedAuthorizer.toLowerCase()) {
    throw new Error("Authorizer mismatch");
  }

  return {
    authorizer: recovered,
    recipient: message.to,
    value: message.value,
    nonce: message.nonce,
  };
}

