import { getAddress, isAddress } from "ethers";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { namehash, normalize } from "viem/ens";

export const ENS_SEPOLIA_CHAIN_ID = 11155111;
export const ARC_CHAIN_ID = 5042002;
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export interface MerchantEnsProfile {
  name: string;
  address: string;
  chainId?: number;
  tokenAddress?: string;
  tokenDecimals?: number;
  node: string;
}

export function normalizeMerchantName(name: string): string {
  const normalized = normalize(name.trim());
  if (!normalized || !normalized.endsWith(".eth")) {
    throw new Error("Enter an ENS .eth name or a wallet address");
  }
  return normalized;
}

export function validateMerchantPaymentProfile(
  profile: Pick<MerchantEnsProfile, "chainId" | "tokenAddress" | "tokenDecimals">,
): void {
  if (profile.chainId !== undefined && profile.chainId !== ARC_CHAIN_ID) {
    throw new Error("ENS payment profile is not configured for Arc Testnet");
  }
  if (profile.tokenAddress !== undefined && getAddress(profile.tokenAddress) !== getAddress(ARC_USDC_ADDRESS)) {
    throw new Error("ENS payment profile points to an unsupported token");
  }
  if (profile.tokenDecimals !== undefined && profile.tokenDecimals !== 6) {
    throw new Error("ENS payment profile has invalid USDC decimals");
  }
}

export async function resolveMerchantName(name: string): Promise<MerchantEnsProfile> {
  const normalized = normalizeMerchantName(name);
  const client = createPublicClient({
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
  });
  const address = await client.getEnsAddress({ name: normalized, coinType: 60n });
  if (address === null || !isAddress(address)) throw new Error("ENS name has no address record");

  const [chainText, tokenText, decimalsText] = await Promise.all([
    client.getEnsText({ name: normalized, key: "melodypay.chainId" }),
    client.getEnsText({ name: normalized, key: "melodypay.token" }),
    client.getEnsText({ name: normalized, key: "melodypay.decimals" }),
  ]);
  const profile: MerchantEnsProfile = {
    name: normalized,
    address: getAddress(address),
    chainId: chainText ? Number(chainText) : undefined,
    tokenAddress: tokenText || undefined,
    tokenDecimals: decimalsText ? Number(decimalsText) : undefined,
    node: namehash(normalized),
  };
  validateMerchantPaymentProfile(profile);
  return profile;
}
