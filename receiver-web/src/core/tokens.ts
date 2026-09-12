import { getAddress, formatUnits } from "ethers";

export interface TokenConfig {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
}

export const VERIFIED_TOKEN_CONFIGS: readonly TokenConfig[] = [
  {
    chainId: 5042002,
    address: "0x3600000000000000000000000000000000000000",
    symbol: "USDC",
    decimals: 6,
  },
];

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
