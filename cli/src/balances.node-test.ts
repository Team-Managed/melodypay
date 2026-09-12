import assert from "node:assert/strict";
import test from "node:test";
import { formatBalance, formatBalanceRows, type BalanceRow } from "./balances.js";

test("formats native and token balances without JSON", () => {
  assert.equal(formatBalance(12345000000000000n, 18), "0.012345");
  assert.equal(formatBalance(1234500n, 6), "1.2345");
});

test("renders balance rows with an error state", () => {
  const rows: BalanceRow[] = [
    { chain: "Monad Testnet", asset: "MON", balance: "1.25", status: "ok" },
    { chain: "Ethereum Sepolia", asset: "ETH", balance: "unavailable", status: "error", error: "RPC timeout" },
  ];

  assert.match(formatBalanceRows(rows), /Monad Testnet/);
  assert.match(formatBalanceRows(rows), /RPC timeout/);
  assert.doesNotMatch(formatBalanceRows(rows), /\{.*\}/s);
});

test("truncates noisy RPC error text for terminal rows", () => {
  const rows: BalanceRow[] = [{
    chain: "Ethereum Mainnet",
    asset: "ETH",
    balance: "unavailable",
    status: "error",
    error: "x".repeat(500),
  }];

  assert.doesNotMatch(formatBalanceRows(rows), /x{200}/);
});
