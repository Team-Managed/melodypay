import { describe, expect, it } from "vitest";
import { getChainConfig, isSupportedChain } from "../src/core/chains";

describe("EVM chain registry", () => {
  it("returns the Monad testnet profile", () => {
    expect(getChainConfig(10143)).toMatchObject({
      chainId: 10143,
      name: "Monad Testnet",
      nativeSymbol: "MON",
    });
  });

  it("rejects chains that are not in the device policy", () => {
    expect(isSupportedChain(999999)).toBe(false);
    expect(getChainConfig(999999)).toBeUndefined();
  });
});
