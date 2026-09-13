import assert from "node:assert/strict";
import test from "node:test";
import { CLI_CHAINS, CLI_TOKENS, getCliChain } from "./chains.js";

test("includes verified Arc Testnet and USDC metadata", () => {
  const arc = getCliChain(5042002);
  assert.equal(arc.rpcUrl, "https://rpc.testnet.arc.io");
  assert.equal(arc.nativeDecimals, 18);
  assert.deepEqual(CLI_TOKENS.find((token) => token.chainId === 5042002), {
    chainId: 5042002,
    address: "0x3600000000000000000000000000000000000000",
    symbol: "USDC",
    decimals: 6,
  });
  assert.equal(CLI_CHAINS.some((chain) => chain.chainId === 5042002), true);
});
