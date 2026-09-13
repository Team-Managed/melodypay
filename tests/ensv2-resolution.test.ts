import { describe, expect, it } from "vitest";
import {
  ARC_USDC_ADDRESS,
  normalizeMerchantName,
  validateMerchantPaymentProfile,
} from "../receiver-web/src/core/ensv2";

describe("ENSv2 merchant profiles", () => {
  it("normalizes ENS names before resolution", () => {
    expect(normalizeMerchantName(" Cafe.MelodyPay.eth ")).toBe("cafe.melodypay.eth");
  });

  it("accepts an Arc USDC profile", () => {
    expect(() => validateMerchantPaymentProfile({
      chainId: 5042002,
      tokenAddress: ARC_USDC_ADDRESS,
      tokenDecimals: 6,
    })).not.toThrow();
  });

  it("rejects a profile for another chain or token", () => {
    expect(() => validateMerchantPaymentProfile({ chainId: 11155111 })).toThrow(/Arc/);
    expect(() => validateMerchantPaymentProfile({ tokenAddress: "0x1111111111111111111111111111111111111111" })).toThrow(/token/);
  });
});
