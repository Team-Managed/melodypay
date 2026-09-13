import { Contract, JsonRpcProvider, Network, formatUnits } from "ethers";
import { CLI_CHAINS, CLI_TOKENS, type CliChain, type CliToken } from "./chains.js";

const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];

export interface BalanceRow {
  chain: string;
  asset: string;
  balance: string;
  status: "ok" | "error";
  error?: string;
}

export function formatBalance(value: bigint, decimals: number): string {
  const formatted = formatUnits(value, decimals);
  return formatted.includes(".") ? formatted.replace(/0+$/, "").replace(/\.$/, "") : formatted;
}

function errorRow(chain: CliChain, asset: string, error: unknown): BalanceRow {
  const message = error instanceof Error ? error.message : String(error);
  return {
    chain: chain.name,
    asset,
    balance: "unavailable",
    status: "error",
    error: message.replace(/\s+/g, " ").slice(0, 120),
  };
}

async function loadChainRows(address: string, chain: CliChain, tokens: readonly CliToken[]): Promise<BalanceRow[]> {
  const provider = new JsonRpcProvider(chain.rpcUrl, Network.from(chain.chainId), { staticNetwork: true });
  try {
    const native = await provider.getBalance(address);
    const rows: BalanceRow[] = [{
      chain: chain.name,
      asset: `${chain.symbol} gas`,
      balance: formatBalance(native, chain.nativeDecimals),
      status: "ok",
    }];
    for (const token of tokens.filter((candidate) => candidate.chainId === chain.chainId)) {
      try {
        const contract = new Contract(token.address, ERC20_ABI, provider);
        const value = await contract.balanceOf(address) as bigint;
        rows.push({
          chain: chain.name,
          asset: token.symbol,
          balance: formatBalance(value, token.decimals),
          status: "ok",
        });
      } catch (error) {
        rows.push(errorRow(chain, token.symbol, error));
      }
    }
    return rows;
  } catch (error) {
    const configuredTokens = tokens.filter((candidate) => candidate.chainId === chain.chainId);
    return [errorRow(chain, chain.symbol, error), ...configuredTokens.map((token) => errorRow(chain, token.symbol, error))];
  }
}

export async function loadBalanceRows(address: string): Promise<BalanceRow[]> {
  const results = await Promise.all(CLI_CHAINS.map((chain) => loadChainRows(address, chain, CLI_TOKENS)));
  return results.flat();
}

export function formatBalanceRows(rows: readonly BalanceRow[]): string {
  const headers = ["CHAIN", "ASSET", "BALANCE", "STATUS"];
  const values = rows.map((row) => [
    row.chain,
    row.asset,
    row.balance,
    row.status === "ok" ? "ok" : `error: ${row.error ?? "unknown"}`.slice(0, 96),
  ]);
  const widths = headers.map((header, index) => Math.max(header.length, ...values.map((row) => row[index].length)));
  const line = (row: string[]) => row.map((value, index) => value.padEnd(widths[index])).join("  ");
  return [line(headers), widths.map((width) => "-".repeat(width)).join("  "), ...values.map(line)].join("\n");
}
