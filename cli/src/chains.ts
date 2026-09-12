export interface CliChain {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
}

export interface CliToken {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
}

export const CLI_CHAINS: readonly CliChain[] = [
  {
    chainId: 10143,
    name: "Monad Testnet",
    symbol: "MON",
    rpcUrl: "https://testnet-rpc.monad.xyz",
    explorerUrl: "https://testnet.monadscan.com",
  },
  {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    symbol: "ETH",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorerUrl: "https://sepolia.etherscan.io",
  },
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    symbol: "ETH",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorerUrl: "https://etherscan.io",
  },
  {
    chainId: 8453,
    name: "Base",
    symbol: "ETH",
    rpcUrl: "https://base-rpc.publicnode.com",
    explorerUrl: "https://basescan.org",
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    symbol: "ETH",
    rpcUrl: "https://arbitrum-one-rpc.publicnode.com",
    explorerUrl: "https://arbiscan.io",
  },
  {
    chainId: 137,
    name: "Polygon",
    symbol: "POL",
    rpcUrl: "https://polygon-bor-rpc.publicnode.com",
    explorerUrl: "https://polygonscan.com",
  },
];

// Add only addresses verified for the target chain. The dashboard handles this
// registry without code changes when verified token metadata is added.
export const CLI_TOKENS: readonly CliToken[] = [];

export function getCliChain(chainId: number): CliChain {
  const chain = CLI_CHAINS.find((candidate) => candidate.chainId === chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);
  return chain;
}
