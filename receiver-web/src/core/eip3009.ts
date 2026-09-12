import {
  getAddress,
  getBytes,
  hexlify,
  randomBytes,
  Signature,
  TypedDataEncoder,
  recoverAddress,
} from "ethers";

export const ARC_CHAIN_ID = 5042002;
export const ARC_CANONICAL_USDC = "0x3600000000000000000000000000000000000000";
export const USDC_EIP712_DOMAIN_NAME = "USDC";
export const USDC_EIP712_DOMAIN_VERSION = "2";

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface ReceiveWithAuthorizationMessage {
  from: string;
  to: string;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: string;
}

export interface TransferWithAuthorizationMessage {
  from: string;
  to: string;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: string;
}

export interface AuthorizationSignature {
  v: number;
  r: string;
  s: string;
  rawSignature: string;
}

export const EIP3009_TYPES = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * Returns the canonical EIP-712 domain for Arc USDC.
 */
export function getArcUsdcDomain(
  chainId: number = ARC_CHAIN_ID,
  verifyingContract: string = ARC_CANONICAL_USDC,
): EIP712Domain {
  return {
    name: USDC_EIP712_DOMAIN_NAME,
    version: USDC_EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract: getAddress(verifyingContract),
  };
}

/**
 * Generates a cryptographically secure 32-byte authorization nonce.
 */
export function generateAuthorizationNonce(): string {
  return hexlify(randomBytes(32));
}

/**
 * Normalizes an authorization message by validating addresses and nonce formatting.
 */
export function normalizeReceiveMessage(
  message: ReceiveWithAuthorizationMessage,
): ReceiveWithAuthorizationMessage {
  const nonceBytes = getBytes(message.nonce);
  if (nonceBytes.length !== 32) {
    throw new Error("Authorization nonce must be precisely 32 bytes");
  }

  return {
    from: getAddress(message.from),
    to: getAddress(message.to),
    value: BigInt(message.value),
    validAfter: BigInt(message.validAfter),
    validBefore: BigInt(message.validBefore),
    nonce: hexlify(nonceBytes),
  };
}

/**
 * Builds the typed data payload structure conforming to EIP-712.
 */
export function buildReceiveAuthorizationTypedData(params: {
  domain?: EIP712Domain;
  from: string;
  to: string;
  value: bigint;
  validAfter?: bigint;
  validBefore: bigint;
  nonce?: string;
}) {
  const domain = params.domain ?? getArcUsdcDomain();
  const nonce = params.nonce ?? generateAuthorizationNonce();
  const validAfter = params.validAfter ?? 0n;

  const message = normalizeReceiveMessage({
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter,
    validBefore: params.validBefore,
    nonce,
  });

  return {
    domain,
    types: {
      ReceiveWithAuthorization: EIP3009_TYPES.ReceiveWithAuthorization,
    },
    primaryType: "ReceiveWithAuthorization" as const,
    message,
  };
}

/**
 * Computes the EIP-712 digest for a ReceiveWithAuthorization payload.
 */
export function getReceiveAuthorizationDigest(
  domain: EIP712Domain,
  message: ReceiveWithAuthorizationMessage,
): string {
  const normalized = normalizeReceiveMessage(message);
  return TypedDataEncoder.hash(
    domain,
    { ReceiveWithAuthorization: EIP3009_TYPES.ReceiveWithAuthorization },
    normalized,
  );
}

/**
 * Parses and splits an authorization signature into v, r, s components.
 */
export function splitAuthorizationSignature(
  signature: string | Uint8Array,
): AuthorizationSignature {
  const sig = Signature.from(signature);
  return {
    v: sig.v,
    r: sig.r,
    s: sig.s,
    rawSignature: sig.serialized,
  };
}

/**
 * Recovers the authorizer address from an EIP-712 digest and signature.
 */
export function recoverReceiveAuthorizationSigner(
  domain: EIP712Domain,
  message: ReceiveWithAuthorizationMessage,
  signature: string | Uint8Array | AuthorizationSignature,
): string {
  const digest = getReceiveAuthorizationDigest(domain, message);
  const rawSig = typeof signature === "object" && "rawSignature" in signature
    ? signature.rawSignature
    : signature;

  return recoverAddress(digest, rawSig);
}
