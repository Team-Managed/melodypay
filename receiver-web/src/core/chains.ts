import { parseEther, parseUnits } from "ethers";

export interface ChainConfig {
  chainId: number;
  name: string;
  nativeSymbol: string;
  rpcUrl: string;
  explorerUrl: string;
  gasLimitCap: number;
  maxNormalFeeWei: bigint;
}

export const CHAIN_CONFIGS: readonly ChainConfig[] = [
  {
    chainId: 10143,
    name: "Monad Testnet",
    nativeSymbol: "MON",
    rpcUrl: "https://testnet-rpc.monad.xyz",
    explorerUrl: "https://testnet.monadscan.com",
    gasLimitCap: 30000,
    maxNormalFeeWei: parseEther("0.01"),
  },
  {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorerUrl: "https://sepolia.etherscan.io",
    gasLimitCap: 30000,
    maxNormalFeeWei: parseEther("0.005"),
  },
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    nativeSymbol: "ETH",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    gasLimitCap: 30000,
    maxNormalFeeWei: parseEther("0.01"),
  },
  {
    chainId: 8453,
    name: "Base",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    gasLimitCap: 30000,
    maxNormalFeeWei: parseEther("0.001"),
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    nativeSymbol: "ETH",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
    gasLimitCap: 30000,
    maxNormalFeeWei: parseEther("0.001"),
  },
  {
    chainId: 137,
    name: "Polygon",
    nativeSymbol: "POL",
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    gasLimitCap: 30000,
    maxNormalFeeWei: parseUnits("0.1", 18),
  },
];

export function getChainConfig(chainId: number | bigint): ChainConfig | undefined {
  const normalized = typeof chainId === "bigint" ? Number(chainId) : chainId;
  if (!Number.isSafeInteger(normalized)) return undefined;
  return CHAIN_CONFIGS.find((config) => config.chainId === normalized);
}

export function isSupportedChain(chainId: number | bigint): boolean {
  return getChainConfig(chainId) !== undefined;
}
