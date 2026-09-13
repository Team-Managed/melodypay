import { describe, expect, it } from "vitest";
import { Wallet } from "ethers";
import {
  buildReceiveAuthorizationTypedData,
  splitAuthorizationSignature,
} from "../receiver-web/src/core/eip3009";
import { validateSignedReceiveAuthorization } from "../receiver-web/src/core/tx-builder";

const payer = new Wallet("0x0123456789012345678901234567890123456789012345678901234567890123");
const recipient = "0x1111111111111111111111111111111111111111";

async function signedAuthorization(overrides: Partial<ReturnType<typeof buildReceiveAuthorizationTypedData>["message"]> = {}) {
  const typedData = buildReceiveAuthorizationTypedData({
    from: payer.address,
    to: recipient,
    value: 1_500_000n,
    validBefore: 1_800_000_000n,
    ...overrides,
  });
  return {
    typedData,
    auth: {
      authorizer: typedData.message.from,
      recipient: typedData.message.to,
      value: typedData.message.value,
      validAfter: typedData.message.validAfter,
      validBefore: typedData.message.validBefore,
      nonce: typedData.message.nonce,
      ...splitAuthorizationSignature(await payer.signTypedData(typedData.domain, typedData.types, typedData.message)),
    },
  };
}

describe("Arc authorization receiver validation", () => {
  it("accepts a matching authorization", async () => {
    const { auth } = await signedAuthorization();
    expect(validateSignedReceiveAuthorization(auth, {
      expectedAuthorizer: payer.address,
      expectedRecipient: recipient,
      expectedValue: 1_500_000n,
    }, 1_700_000_000)).toMatchObject({
      authorizer: payer.address,
      recipient,
      value: 1_500_000n,
    });
  });

  it("rejects a modified recipient", async () => {
    const { auth } = await signedAuthorization();
    expect(() => validateSignedReceiveAuthorization({ ...auth, recipient: "0x2222222222222222222222222222222222222222" }, {
      expectedAuthorizer: payer.address,
      expectedRecipient: recipient,
      expectedValue: 1_500_000n,
    }, 1_700_000_000)).toThrow(/recipient/i);
  });

  it("rejects an expired authorization", async () => {
    const { auth } = await signedAuthorization({ validBefore: 1_600_000_000n });
    expect(() => validateSignedReceiveAuthorization(auth, {
      expectedAuthorizer: payer.address,
      expectedRecipient: recipient,
      expectedValue: 1_500_000n,
    }, 1_700_000_000)).toThrow(/expired/i);
  });
});
