import { describe, expect, it } from "vitest";
import { Wallet, getAddress } from "ethers";
import {
  ARC_CHAIN_ID,
  ARC_CANONICAL_USDC,
  getArcUsdcDomain,
  generateAuthorizationNonce,
  buildReceiveAuthorizationTypedData,
  getReceiveAuthorizationDigest,
  splitAuthorizationSignature,
  recoverReceiveAuthorizationSigner,
  ReceiveWithAuthorizationMessage,
} from "../receiver-web/src/core/eip3009";
import {
  assembleFrames,
  decodeSignedAuthorization,
  encodeSignedAuthorization,
  SignedAuthorizationPayload,
} from "../receiver-web/src/core/payment-protocol";

describe("Canonical EIP-3009 and EIP-712 Typed Data", () => {
  const domain = getArcUsdcDomain();

  it("constructs the exact Arc canonical EIP-712 domain", () => {
    expect(domain).toEqual({
      name: "USDC",
      version: "2",
      chainId: ARC_CHAIN_ID,
      verifyingContract: getAddress(ARC_CANONICAL_USDC),
    });
  });

  it("generates a cryptographically random 32-byte hex nonce", () => {
    const nonce1 = generateAuthorizationNonce();
    const nonce2 = generateAuthorizationNonce();

    expect(nonce1).toMatch(/^0x[0-9a-f]{64}$/);
    expect(nonce2).toMatch(/^0x[0-9a-f]{64}$/);
    expect(nonce1).not.toBe(nonce2);
  });

  it("signs and recovers a ReceiveWithAuthorization payload correctly", async () => {
    const wallet = Wallet.createRandom();
    const recipient = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";
    const amount = 1_000_000n; // 1.0 USDC
    const nonce = generateAuthorizationNonce();
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300);

    const typedData = buildReceiveAuthorizationTypedData({
      domain,
      from: wallet.address,
      to: recipient,
      value: amount,
      validAfter: 0n,
      validBefore,
      nonce,
    });

    const rawSignature = await wallet.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message,
    );

    const splitSig = splitAuthorizationSignature(rawSignature);
    expect(splitSig.v).toBeGreaterThanOrEqual(27);
    expect(splitSig.r).toMatch(/^0x[0-9a-f]{64}$/);
    expect(splitSig.s).toMatch(/^0x[0-9a-f]{64}$/);

    const recovered = recoverReceiveAuthorizationSigner(
      domain,
      typedData.message,
      splitSig,
    );

    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it("produces distinct digests when parameters change", () => {
    const baseMessage: ReceiveWithAuthorizationMessage = {
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: 1_000_000n,
      validAfter: 0n,
      validBefore: 1700000000n,
      nonce: "0x" + "01".repeat(32),
    };

    const baseDigest = getReceiveAuthorizationDigest(domain, baseMessage);

    // Changing recipient
    const differentRecipient = getReceiveAuthorizationDigest(domain, {
      ...baseMessage,
      to: "0x3333333333333333333333333333333333333333",
    });
    expect(differentRecipient).not.toBe(baseDigest);

    // Changing value
    const differentValue = getReceiveAuthorizationDigest(domain, {
      ...baseMessage,
      value: 2_000_000n,
    });
    expect(differentValue).not.toBe(baseDigest);

    // Changing nonce
    const differentNonce = getReceiveAuthorizationDigest(domain, {
      ...baseMessage,
      nonce: "0x" + "02".repeat(32),
    });
    expect(differentNonce).not.toBe(baseDigest);

    // Changing chain ID
    const differentChainDomain = { ...domain, chainId: 1 };
    const differentChainDigest = getReceiveAuthorizationDigest(differentChainDomain, baseMessage);
    expect(differentChainDigest).not.toBe(baseDigest);

    // Changing verifying contract
    const differentContractDomain = {
      ...domain,
      verifyingContract: "0x0000000000000000000000000000000000000001",
    };
    const differentContractDigest = getReceiveAuthorizationDigest(differentContractDomain, baseMessage);
    expect(differentContractDigest).not.toBe(baseDigest);
  });

  it("round-trips SignedAuthorization through chunked audio frame protocol", () => {
    const payload: SignedAuthorizationPayload = {
      authorizer: "0xA11CE00000000000000000000000000000000001",
      recipient: "0xB0B0000000000000000000000000000000000002",
      value: 5_000_000n, // 5.0 USDC
      validAfter: 0n,
      validBefore: 1800000000n,
      nonce: "0x" + "ab".repeat(32),
      v: 28,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    };

    const frames = encodeSignedAuthorization(payload, 42);
    expect(frames.length).toBe(2); // 185 byte payload fits in 2 chunks of <=128 bytes

    const assembled = assembleFrames(frames);
    const decoded = decodeSignedAuthorization(assembled);

    expect(decoded.payload.authorizer.toLowerCase()).toBe(payload.authorizer.toLowerCase());
    expect(decoded.payload.recipient.toLowerCase()).toBe(payload.recipient.toLowerCase());
    expect(decoded.payload.value).toBe(payload.value);
    expect(decoded.payload.validAfter).toBe(payload.validAfter);
    expect(decoded.payload.validBefore).toBe(payload.validBefore);
    expect(decoded.payload.nonce).toBe(payload.nonce);
    expect(decoded.payload.v).toBe(payload.v);
    expect(decoded.payload.r).toBe(payload.r);
    expect(decoded.payload.s).toBe(payload.s);
  });
});
