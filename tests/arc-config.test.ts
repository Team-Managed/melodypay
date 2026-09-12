import { describe, expect, it } from "vitest";
import { getChainConfig, isSupportedChain } from "../receiver-web/src/core/chains";
import { getVerifiedToken, formatTokenAmount } from "../receiver-web/src/core/tokens";
import { getCliChain } from "../cli/src/chains";

describe("Arc Network and canonical USDC configuration", () => {
  const ARC_CHAIN_ID = 5042002;
  const ARC_CANONICAL_USDC = "0x3600000000000000000000000000000000000000";

  it("registers Arc Testnet with chain ID 5042002 and USDC native gas", () => {
    expect(isSupportedChain(ARC_CHAIN_ID)).toBe(true);

    const config = getChainConfig(ARC_CHAIN_ID);
    expect(config).toBeDefined();
    expect(config).toMatchObject({
      chainId: ARC_CHAIN_ID,
      name: "Arc Testnet",
      nativeSymbol: "USDC",
      rpcUrl: "https://rpc.testnet.arc.io",
      explorerUrl: "https://testnet.arcscan.app",
    });
  });

  it("registers canonical Arc USDC with 6 decimals", () => {
    const token = getVerifiedToken(ARC_CHAIN_ID, ARC_CANONICAL_USDC);
    expect(token).toBeDefined();
    expect(token).toMatchObject({
      chainId: ARC_CHAIN_ID,
      address: ARC_CANONICAL_USDC,
      symbol: "USDC",
      decimals: 6,
    });
  });

  it("rejects unverified or stale token addresses on Arc", () => {
    const wrongAddress = "0x1111111111111111111111111111111111111111";
    expect(getVerifiedToken(ARC_CHAIN_ID, wrongAddress)).toBeUndefined();
    expect(getVerifiedToken(ARC_CHAIN_ID, "not-an-address")).toBeUndefined();
  });

  it("keeps 18-decimal native gas precision distinct from 6-decimal token units", () => {
    const chain = getChainConfig(ARC_CHAIN_ID)!;
    // Native gas maxNormalFeeWei is 18-decimal (0.05 ether / units)
    expect(chain.maxNormalFeeWei).toBe(50000000000000000n);

    // Token amount is 6-decimal (1 USDC = 1_000_000n)
    const token = getVerifiedToken(ARC_CHAIN_ID, ARC_CANONICAL_USDC)!;
    const formatted = formatTokenAmount(1_000_000n, token);
    expect(formatted).toBe("1.0 USDC");
  });

  it("exposes Arc Testnet in CLI chains registry", () => {
    const cliChain = getCliChain(ARC_CHAIN_ID);
    expect(cliChain).toMatchObject({
      chainId: ARC_CHAIN_ID,
      name: "Arc Testnet",
      symbol: "USDC",
      rpcUrl: "https://rpc.testnet.arc.io",
      explorerUrl: "https://testnet.arcscan.app",
    });
  });
});
