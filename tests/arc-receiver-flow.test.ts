import { describe, expect, it } from "vitest";
import { Wallet, parseUnits } from "ethers";
import {
  validateSignedReceiveAuthorization,
} from "../receiver-web/src/core/tx-builder";
import {
  getArcUsdcDomain,
  generateAuthorizationNonce,
  buildReceiveAuthorizationTypedData,
  splitAuthorizationSignature,
} from "../receiver-web/src/core/eip3009";
import {
  createArcAuthorizationRequest,
} from "../cli/src/receiver";

describe("Arc EIP-3009 receiver flow and validation", () => {
  const ARC_CHAIN_ID = 5042002;
  const ARC_USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
  const domain = getArcUsdcDomain();

  it("validates a correctly signed Arc ReceiveWithAuthorization payload", async () => {
    const payer = Wallet.createRandom();
    const merchant = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";
    const amountUnits = parseUnits("2.5", 6); // 2.5 USDC
    const nonce = generateAuthorizationNonce();
    const now = Math.floor(Date.now() / 1000);
    const validBefore = BigInt(now + 120);

    const typedData = buildReceiveAuthorizationTypedData({
      domain,
      from: payer.address,
      to: merchant,
      value: amountUnits,
      validAfter: 0n,
      validBefore,
      nonce,
    });

    const rawSig = await payer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message,
    );
    const splitSig = splitAuthorizationSignature(rawSig);

    const authPayload = {
      authorizer: payer.address,
      recipient: merchant,
      value: amountUnits,
      validAfter: 0n,
      validBefore,
      nonce,
      v: splitSig.v,
      r: splitSig.r,
      s: splitSig.s,
    };

    const validated = validateSignedReceiveAuthorization(
      authPayload,
      {
        expectedAuthorizer: payer.address,
        expectedRecipient: merchant,
        expectedValue: amountUnits,
        chainId: ARC_CHAIN_ID,
        verifyingContract: ARC_USDC_CONTRACT,
      },
      now,
    );

    expect(validated.authorizer.toLowerCase()).toBe(payer.address.toLowerCase());
    expect(validated.recipient.toLowerCase()).toBe(merchant.toLowerCase());
    expect(validated.value).toBe(amountUnits);
    expect(validated.nonce).toBe(nonce);
  });

  it("rejects an authorization when recipient does not match", async () => {
    const payer = Wallet.createRandom();
    const merchant = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";
    const amountUnits = parseUnits("1.0", 6);
    const nonce = generateAuthorizationNonce();
    const now = Math.floor(Date.now() / 1000);

    const authPayload = {
      authorizer: payer.address,
      recipient: "0x1111111111111111111111111111111111111111",
      value: amountUnits,
      validAfter: 0n,
      validBefore: BigInt(now + 60),
      nonce,
      v: 27,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    };

    expect(() =>
      validateSignedReceiveAuthorization(
        authPayload,
        {
          expectedRecipient: merchant,
          expectedValue: amountUnits,
        },
        now,
      ),
    ).toThrow("Recipient mismatch");
  });

  it("rejects an authorization when amount does not match", async () => {
    const payer = Wallet.createRandom();
    const merchant = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";
    const expectedUnits = parseUnits("5.0", 6);
    const signedUnits = parseUnits("1.0", 6);
    const nonce = generateAuthorizationNonce();
    const now = Math.floor(Date.now() / 1000);

    const authPayload = {
      authorizer: payer.address,
      recipient: merchant,
      value: signedUnits,
      validAfter: 0n,
      validBefore: BigInt(now + 60),
      nonce,
      v: 27,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    };

    expect(() =>
      validateSignedReceiveAuthorization(
        authPayload,
        {
          expectedRecipient: merchant,
          expectedValue: expectedUnits,
        },
        now,
      ),
    ).toThrow("Value mismatch");
  });

  it("rejects an authorization when expired", async () => {
    const payer = Wallet.createRandom();
    const merchant = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";
    const amountUnits = parseUnits("1.0", 6);
    const nonce = generateAuthorizationNonce();
    const now = 1700000000;
    const expiredValidBefore = BigInt(now - 1);

    const authPayload = {
      authorizer: payer.address,
      recipient: merchant,
      value: amountUnits,
      validAfter: 0n,
      validBefore: expiredValidBefore,
      nonce,
      v: 27,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    };

    expect(() =>
      validateSignedReceiveAuthorization(
        authPayload,
        {
          expectedRecipient: merchant,
          expectedValue: amountUnits,
        },
        now,
      ),
    ).toThrow("Authorization expired");
  });

  it("rejects an authorization when not yet valid", async () => {
    const payer = Wallet.createRandom();
    const merchant = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";
    const amountUnits = parseUnits("1.0", 6);
    const nonce = generateAuthorizationNonce();
    const now = 1700000000;
    const futureValidAfter = BigInt(now + 100);

    const authPayload = {
      authorizer: payer.address,
      recipient: merchant,
      value: amountUnits,
      validAfter: futureValidAfter,
      validBefore: BigInt(now + 200),
      nonce,
      v: 27,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    };

    expect(() =>
      validateSignedReceiveAuthorization(
        authPayload,
        {
          expectedRecipient: merchant,
          expectedValue: amountUnits,
        },
        now,
      ),
    ).toThrow("Authorization not yet valid");
  });

  it("creates valid Arc CLI authorization requests with 6 decimals", () => {
    const merchant = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";
    const request = createArcAuthorizationRequest(merchant, "10.5", 60);

    expect(request.chainId).toBe(5042002);
    expect(request.tokenAddress).toBe("0x3600000000000000000000000000000000000000");
    expect(request.recipient.toLowerCase()).toBe(merchant.toLowerCase());
    expect(request.amount).toBe("10.5");
    expect(request.valueUnits).toBe(10_500_000n); // 10.5 * 10^6
    expect(request.nonce).toMatch(/^0x[0-9a-f]{64}$/);
    expect(request.validAfter).toBe(0n);
    expect(request.validBefore).toBeGreaterThan(0n);
  });
});
