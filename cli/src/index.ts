import {
  cancel,
  confirm,
  intro,
  isCancel,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { ethers } from "ethers";
import { CLI_CHAINS, getCliChain } from "./chains.js";
import { getPaymentRequest, validateAndBroadcast, type ReceiverRequest } from "./receiver.js";

type Action = "payment" | "inspect" | "networks" | "exit";

function cancelled<T>(value: T | symbol): value is symbol {
  if (isCancel(value)) {
    cancel("Operation cancelled");
    return true;
  }
  return false;
}

async function requiredText(message: string, placeholder?: string): Promise<string | null> {
  const value = await text({ message, placeholder, validate: (input) => input.trim() ? undefined : "Required" });
  return cancelled(value) ? null : value.trim();
}

async function chooseChain(): Promise<number | null> {
  const value = await select({
    message: "Select network",
    options: CLI_CHAINS.map((chain) => ({
      value: chain.chainId,
      label: `${chain.name} (${chain.symbol})`,
      hint: `chain ${chain.chainId}`,
    })),
  });
  return cancelled(value) ? null : value;
}

async function paymentTerminal() {
  const chainId = await chooseChain();
  if (chainId === null) return;
  const recipient = await requiredText("Merchant receiving address", "0x...");
  if (!recipient) return;
  const amount = await requiredText("Amount", "0.01");
  if (!amount) return;
  const sender = await requiredText("Hardware wallet address", "0x...");
  if (!sender) return;

  const loader = spinner();
  loader.start("Fetching nonce and fee data");
  try {
    const request = await getPaymentRequest(chainId, recipient, amount, sender);
    loader.stop("Payment request ready");
    console.log(JSON.stringify({
      ...request,
      maxFeePerGas: request.maxFeePerGas.toString(),
      maxPriorityFeePerGas: request.maxPriorityFeePerGas.toString(),
    }, null, 2));
    console.log("Audio adapter boundary: play this request to the hardware wallet.");

    const signed = await requiredText("Paste signed transaction", "0x...");
    if (!signed) return;
    const broadcastLoader = spinner();
    broadcastLoader.start("Validating and broadcasting");
    const hash = await validateAndBroadcast(signed, request);
    broadcastLoader.stop("Broadcast complete");
    console.log(`Transaction: ${hash}`);
  } catch (error) {
    loader.stop("Payment failed", 1);
    console.error(error instanceof Error ? error.message : error);
  }
}

async function inspectTransaction() {
  const signed = await requiredText("Signed transaction", "0x...");
  if (!signed) return;
  try {
    const tx = ethers.Transaction.from(signed);
    console.log(JSON.stringify({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      chainId: tx.chainId?.toString(),
      value: tx.value.toString(),
      nonce: tx.nonce,
      gasLimit: tx.gasLimit.toString(),
      dataBytes: (ethers.getBytes(tx.data)).length,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

function showNetworks() {
  for (const chain of CLI_CHAINS) {
    console.log(`${chain.name.padEnd(20)} ${String(chain.chainId).padEnd(10)} ${chain.symbol}  ${chain.rpcUrl}`);
  }
}

async function main() {
  intro("MelodyPay Receiver CLI | keyless operator terminal");

  for (;;) {
    const action = await select<Action>({
      message: "Select an operation",
      options: [
        { value: "payment", label: "Payment terminal", hint: "create request, validate, broadcast" },
        { value: "inspect", label: "Inspect signed transaction", hint: "offline parsing only" },
        { value: "networks", label: "Network profiles", hint: "show configured EVM chains" },
        { value: "exit", label: "Exit" },
      ],
    });
    if (cancelled(action) || action === "exit") break;

    if (action === "payment") await paymentTerminal();
    if (action === "inspect") await inspectTransaction();
    if (action === "networks") showNetworks();

    const continueRunning = await confirm({ message: "Return to operator menu?", initialValue: true });
    if (cancelled(continueRunning) || !continueRunning) break;
  }

  outro("MelodyPay receiver stopped");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
