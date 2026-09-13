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

  it("accepts profiles for every supported wallet chain", () => {
    expect(() => validateMerchantPaymentProfile({
      chainId: 5042002,
      tokenAddress: ARC_USDC_ADDRESS,
      tokenDecimals: 6,
    })).not.toThrow();
    expect(() => validateMerchantPaymentProfile({ chainId: 10143 })).not.toThrow();
    expect(() => validateMerchantPaymentProfile({ chainId: 11155111 })).not.toThrow();
  });

  it("rejects unsupported profile metadata", () => {
    expect(() => validateMerchantPaymentProfile({ chainId: 999999 })).toThrow(/unsupported chain/i);
    expect(() => validateMerchantPaymentProfile({ tokenAddress: "not-an-address" })).toThrow(/token address/i);
    expect(() => validateMerchantPaymentProfile({ tokenDecimals: 37 })).toThrow(/decimals/i);
  });
});
