import { describe, expect, it } from "vitest";
import { Wallet, parseUnits } from "ethers";
import { validateSignedErc20Transfer } from "../receiver-web/src/core/tx-builder";

const privateKey = "0x0123456789012345678901234567890123456789012345678901234567890123";
const tokenContract = "0x2222222222222222222222222222222222222222";
const recipient = "0x1111111111111111111111111111111111111111";

describe("ERC-20 transfer validation", () => {
  it("accepts only a standard transfer call to the configured token", async () => {
    const wallet = new Wallet(privateKey);
    const amount = parseUnits("12.5", 6);
    const data = "0xa9059cbb" + recipient.slice(2).padStart(64, "0") + amount.toString(16).padStart(64, "0");
    const signed = await wallet.signTransaction({
      type: 2,
      chainId: 10143,
      nonce: 8,
      to: tokenContract,
      value: 0,
      data,
      gasLimit: 65000,
      maxPriorityFeePerGas: parseUnits("2", "gwei"),
      maxFeePerGas: parseUnits("150", "gwei"),
    });

    await expect(validateSignedErc20Transfer(signed, {
      sender: wallet.address,
      tokenContract,
      tokenRecipient: recipient,
      tokenAmount: amount,
      chainId: 10143,
      nonce: 8,
      gasLimit: 65000n,
    })).resolves.toBeDefined();
  });

  it("rejects an approval selector", async () => {
    const wallet = new Wallet(privateKey);
    const signed = await wallet.signTransaction({
      type: 2,
      chainId: 10143,
      nonce: 8,
      to: tokenContract,
      value: 0,
      data: "0x095ea7b3" + recipient.slice(2).padStart(64, "0") + "ff".repeat(32),
      gasLimit: 65000,
      maxPriorityFeePerGas: parseUnits("2", "gwei"),
      maxFeePerGas: parseUnits("150", "gwei"),
    });

    await expect(validateSignedErc20Transfer(signed, {
      sender: wallet.address,
      tokenContract,
      tokenRecipient: recipient,
      tokenAmount: 1n,
      chainId: 10143,
      nonce: 8,
      gasLimit: 65000n,
    })).rejects.toThrow(/selector|transfer/i);
  });
});
