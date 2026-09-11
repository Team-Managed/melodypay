export interface CliChain {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
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
];

export function getCliChain(chainId: number): CliChain {
  const chain = CLI_CHAINS.find((candidate) => candidate.chainId === chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);
  return chain;
}
