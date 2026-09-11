import { describe, expect, it } from "vitest";
import { Wallet, parseEther, parseUnits } from "ethers";
import {
  validateSignedNativeTransfer,
  type NativeTransferExpectation,
} from "../src/core/tx-builder";

const privateKey = "0x0123456789012345678901234567890123456789012345678901234567890123";

async function makeSignedTransaction() {
  const wallet = new Wallet(privateKey);
  return wallet.signTransaction({
    type: 2,
    chainId: 10143,
    nonce: 7,
    to: "0x1111111111111111111111111111111111111111",
    value: parseEther("0.01"),
    gasLimit: 21000,
    maxPriorityFeePerGas: parseUnits("2", "gwei"),
    maxFeePerGas: parseUnits("150", "gwei"),
  });
}

const expected: NativeTransferExpectation = {
  sender: new Wallet(privateKey).address,
  recipient: "0x1111111111111111111111111111111111111111",
  chainId: 10143,
  value: parseEther("0.01"),
  nonce: 7,
  gasLimit: 21000n,
  maxPriorityFeePerGas: parseUnits("2", "gwei"),
  maxFeePerGas: parseUnits("150", "gwei"),
};

describe("signed native transfer validation", () => {
  it("accepts a transaction matching the payment request", async () => {
    await expect(validateSignedNativeTransfer(await makeSignedTransaction(), expected)).resolves.toBeDefined();
  });

  it("rejects a transaction signed for another chain", async () => {
    await expect(
      validateSignedNativeTransfer(await makeSignedTransaction(), { ...expected, chainId: 11155111 }),
    ).rejects.toThrow(/chain/i);
  });
});
