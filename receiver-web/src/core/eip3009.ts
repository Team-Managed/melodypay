import {
  AbiCoder,
  getAddress,
  getBytes,
  hexlify,
  id,
  randomBytes,
  recoverAddress,
  Signature,
  TypedDataEncoder,
  zeroPadValue,
} from "ethers";

export const ARC_CHAIN_ID = 5042002;
export const ARC_CANONICAL_USDC = "0x3600000000000000000000000000000000000000";

export const EIP3009_TYPES = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export interface ReceiveAuthorizationMessage {
  from: string;
  to: string;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: string;
}

export interface ReceiveAuthorizationTypedData {
  domain: {
    name: "USDC";
    version: "2";
    chainId: number;
    verifyingContract: string;
  };
  types: typeof EIP3009_TYPES;
  primaryType: "ReceiveWithAuthorization";
  message: ReceiveAuthorizationMessage;
}

export function generateAuthorizationNonce(): string {
  return hexlify(randomBytes(32));
}

function normalizeMessage(message: ReceiveAuthorizationMessage): ReceiveAuthorizationMessage {
  const nonce = getBytes(message.nonce);
  if (nonce.length !== 32) throw new Error("Authorization nonce must be 32 bytes");
  return {
    from: getAddress(message.from),
    to: getAddress(message.to),
    value: BigInt(message.value),
    validAfter: BigInt(message.validAfter),
    validBefore: BigInt(message.validBefore),
    nonce: hexlify(nonce),
  };
}

export function buildReceiveAuthorizationTypedData(params: {
  from: string;
  to: string;
  value: bigint;
  validBefore: bigint;
  validAfter?: bigint;
  nonce?: string;
}): ReceiveAuthorizationTypedData {
  return {
    domain: {
      name: "USDC",
      version: "2",
      chainId: ARC_CHAIN_ID,
      verifyingContract: getAddress(ARC_CANONICAL_USDC),
    },
    types: EIP3009_TYPES,
    primaryType: "ReceiveWithAuthorization",
    message: normalizeMessage({
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter ?? 0n,
      validBefore: params.validBefore,
      nonce: params.nonce ?? generateAuthorizationNonce(),
    }),
  };
}

export function getReceiveAuthorizationDigest(
  domain: ReceiveAuthorizationTypedData["domain"],
  message: ReceiveAuthorizationMessage,
): string {
  return TypedDataEncoder.hash(domain, EIP3009_TYPES, normalizeMessage(message));
}

export function splitAuthorizationSignature(signature: string): {
  v: number;
  r: string;
  s: string;
  rawSignature: string;
} {
  const parsed = Signature.from(signature);
  return { v: parsed.v, r: parsed.r, s: parsed.s, rawSignature: parsed.serialized };
}

export interface ArcReceiptLog {
  topics: readonly string[];
  data: string;
}

const ARC_TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const ARC_NATIVE_DECIMAL_FACTOR = 10n ** 12n;
const ARC_UINT256_DECODER = AbiCoder.defaultAbiCoder();

/**
 * Arc can emit the same USDC movement through its ERC-20 interface (6 decimals)
 * and its native system emitter (18 decimals). Match raw topics instead of
 * relying on the token interface's emitter assumptions.
 */
export function hasArcTransferEvidence(
  logs: readonly ArcReceiptLog[],
  expectedFrom: string,
  expectedTo: string,
  expectedValue: bigint,
): boolean {
  const fromTopic = zeroPadValue(getAddress(expectedFrom), 32).toLowerCase();
  const toTopic = zeroPadValue(getAddress(expectedTo), 32).toLowerCase();

  return logs.some((log) => {
    if (log.topics[0]?.toLowerCase() !== ARC_TRANSFER_TOPIC.toLowerCase()) return false;
    if (log.topics[1]?.toLowerCase() !== fromTopic || log.topics[2]?.toLowerCase() !== toTopic) return false;

    try {
      const [value] = ARC_UINT256_DECODER.decode(["uint256"], log.data);
      return value === expectedValue || value === expectedValue * ARC_NATIVE_DECIMAL_FACTOR;
    } catch {
      return false;
    }
  });
}

export function recoverReceiveAuthorizationSigner(
  domain: ReceiveAuthorizationTypedData["domain"],
  message: ReceiveAuthorizationMessage,
  signature: string,
): string {
  return recoverAddress(getReceiveAuthorizationDigest(domain, message), signature);
}
