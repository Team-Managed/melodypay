import { ethers } from "ethers";
import { getCliChain } from "./chains.js";

export interface ReceiverRequest {
  chainId: number;
  recipient: string;
  amount: string;
  nonce: number;
  requestId: number;
  ttlSeconds: number;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export function createPaymentRequest(
  chainId: number,
  recipient: string,
  amount: string,
  nonce: number,
  requestId = Math.floor(Math.random() * 0x1_0000_0000) >>> 0,
): ReceiverRequest {
  const chain = getCliChain(chainId);
  if (!ethers.isAddress(recipient)) throw new Error("Invalid recipient address");

  return {
    chainId,
    recipient: ethers.getAddress(recipient),
    amount,
    nonce,
    requestId,
    ttlSeconds: 60,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
  };
}

export async function getPaymentRequest(
  chainId: number,
  recipient: string,
  amount: string,
  sender: string,
): Promise<ReceiverRequest> {
  const chain = getCliChain(chainId);
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const [nonce, feeData] = await Promise.all([
    provider.getTransactionCount(sender),
    provider.getFeeData(),
  ]);
  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  if (maxFeePerGas === null) throw new Error("RPC did not return fee data");

  const request = createPaymentRequest(chainId, recipient, amount, nonce);
  return {
    ...request,
    maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 0n,
  };
}

export async function validateAndBroadcast(
  signedTransaction: string,
  request: ReceiverRequest,
): Promise<string> {
  const chain = getCliChain(request.chainId);
  const parsed = ethers.Transaction.from(signedTransaction);
  const expectedValue = ethers.parseEther(request.amount);

  if (parsed.type !== 2) throw new Error("Only EIP-1559 transactions are supported");
  if (!parsed.from) throw new Error("Could not recover sender");
  if (parsed.chainId !== BigInt(request.chainId)) throw new Error("Chain ID mismatch");
  if (parsed.to?.toLowerCase() !== request.recipient.toLowerCase()) throw new Error("Recipient mismatch");
  if (parsed.value !== expectedValue) throw new Error("Amount mismatch");
  if (parsed.nonce !== request.nonce) throw new Error("Nonce mismatch");
  if (parsed.data !== "0x") throw new Error("Native payment contains calldata");

  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const response = await provider.broadcastTransaction(signedTransaction);
  return response.hash;
}

export interface ArcAuthorizationRequest {
  chainId: number;
  tokenAddress: string;
  recipient: string;
  amount: string; // e.g. "1.5"
  valueUnits: bigint; // 6-decimal units
  nonce: string;
  validAfter: bigint;
  validBefore: bigint;
  requestId: number;
}

export function createArcAuthorizationRequest(
  recipient: string,
  amount: string,
  ttlSeconds: number = 60,
  nonce?: string,
): ArcAuthorizationRequest {
  if (!ethers.isAddress(recipient)) throw new Error("Invalid recipient address");

  const normalizedNonce = nonce ?? ethers.hexlify(ethers.randomBytes(32));
  const valueUnits = ethers.parseUnits(amount, 6);
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

  return {
    chainId: 5042002,
    tokenAddress: "0x3600000000000000000000000000000000000000",
    recipient: ethers.getAddress(recipient),
    amount,
    valueUnits,
    nonce: normalizedNonce,
    validAfter: 0n,
    validBefore: currentTimestamp + BigInt(ttlSeconds),
    requestId: Math.floor(Math.random() * 0x1_0000_0000) >>> 0,
  };
}

export async function validateAndBroadcastArcAuthorization(
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
  request: ArcAuthorizationRequest,
  broadcasterSigner?: ethers.Signer,
): Promise<{ hash: string; arcScanUrl: string }> {
  if (auth.recipient.toLowerCase() !== request.recipient.toLowerCase()) {
    throw new Error("Recipient mismatch");
  }
  if (auth.value !== request.valueUnits) {
    throw new Error("Amount mismatch");
  }
  if (auth.nonce.toLowerCase() !== request.nonce.toLowerCase()) {
    throw new Error("Nonce mismatch");
  }

  const chain = getCliChain(request.chainId);
  const provider = broadcasterSigner?.provider ?? new ethers.JsonRpcProvider(chain.rpcUrl);

  const ARC_USDC_ABI = [
    "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
  ];

  if (!broadcasterSigner) {
    throw new Error("Broadcaster signer required to submit receiveWithAuthorization");
  }

  const usdcContract = new ethers.Contract(request.tokenAddress, ARC_USDC_ABI, broadcasterSigner);
  const tx = await usdcContract.receiveWithAuthorization(
    auth.authorizer,
    auth.recipient,
    auth.value,
    auth.validAfter,
    auth.validBefore,
    auth.nonce,
    auth.v,
    auth.r,
    auth.s,
  );

  const receipt = await tx.wait();
  return {
    hash: receipt.hash,
    arcScanUrl: `${chain.explorerUrl}/tx/${receipt.hash}`,
  };
}

