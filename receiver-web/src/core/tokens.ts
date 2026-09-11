import { getAddress, formatUnits } from "ethers";

export interface TokenConfig {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
}

// Keep this list empty until each token address is verified on its target chain.
// A receiver must not turn an arbitrary user-entered address into a hardware
// wallet signing policy.
export const VERIFIED_TOKEN_CONFIGS: readonly TokenConfig[] = [];

export function getVerifiedToken(chainId: number, address: string): TokenConfig | undefined {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return undefined;
  const normalized = getAddress(address);
  return VERIFIED_TOKEN_CONFIGS.find(
    (token) => token.chainId === chainId && getAddress(token.address) === normalized,
  );
}

export function formatTokenAmount(amount: bigint, token: TokenConfig): string {
  return `${formatUnits(amount, token.decimals)} ${token.symbol}`;
}
