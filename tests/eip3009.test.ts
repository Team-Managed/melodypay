import { describe, expect, it } from "vitest";
import { Wallet, TypedDataEncoder } from "ethers";
import {
  ARC_CHAIN_ID,
  ARC_CANONICAL_USDC,
  EIP3009_TYPES,
  buildReceiveAuthorizationTypedData,
  generateAuthorizationNonce,
  recoverReceiveAuthorizationSigner,
} from "../receiver-web/src/core/eip3009";

const payer = new Wallet("0x0123456789012345678901234567890123456789012345678901234567890123");
const recipient = "0x1111111111111111111111111111111111111111";

describe("Arc EIP-3009 authorization", () => {
  it("builds canonical USDC receive authorization typed data", () => {
    const authorization = buildReceiveAuthorizationTypedData({
      from: payer.address,
      to: recipient,
      value: 1_500_000n,
      validBefore: 1_800_000_000n,
    });

    expect(authorization.domain).toEqual({
      name: "USDC",
      version: "2",
      chainId: ARC_CHAIN_ID,
      verifyingContract: ARC_CANONICAL_USDC,
    });
    expect(authorization.message.value).toBe(1_500_000n);
    expect(authorization.message.nonce).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("recovers the payer from a canonical typed-data signature", async () => {
    const authorization = buildReceiveAuthorizationTypedData({
      from: payer.address,
      to: recipient,
      value: 1_000_000n,
      validBefore: 1_800_000_000n,
      nonce: generateAuthorizationNonce(),
    });
    const signature = await payer.signTypedData(
      authorization.domain,
      { ReceiveWithAuthorization: EIP3009_TYPES.ReceiveWithAuthorization },
      authorization.message,
    );

    expect(recoverReceiveAuthorizationSigner(authorization.domain, authorization.message, signature)).toBe(payer.address);
    expect(TypedDataEncoder.hash(authorization.domain, authorization.types, authorization.message)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("changes the digest when recipient or nonce changes", () => {
    const base = buildReceiveAuthorizationTypedData({
      from: payer.address,
      to: recipient,
      value: 1_000_000n,
      validBefore: 1_800_000_000n,
      nonce: generateAuthorizationNonce(),
    });
    const changed = buildReceiveAuthorizationTypedData({
      ...base.message,
      from: payer.address,
      to: "0x2222222222222222222222222222222222222222",
      validBefore: base.message.validBefore,
      nonce: generateAuthorizationNonce(),
    });

    expect(TypedDataEncoder.hash(base.domain, base.types, base.message)).not.toBe(
      TypedDataEncoder.hash(changed.domain, changed.types, changed.message),
    );
  });
});
