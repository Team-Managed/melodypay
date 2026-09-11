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
