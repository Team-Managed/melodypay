import {
  intro,
  isCancel,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { ethers } from "ethers";
import { formatBalanceRows, loadBalanceRows } from "./balances.js";
import { CLI_CHAINS, getCliChain } from "./chains.js";
import { getPaymentRequest, validateAndBroadcast, type ReceiverRequest } from "./receiver.js";
import { DeviceClient } from "./device.js";
import { connectDevice, listSerialPorts, type DeviceConnection } from "./serial.js";
import { isBackNavigation } from "./navigation.js";

type Action = "dashboard" | "device" | "status" | "networks" | "payment" | "diagnostics" | "inspect" | "exit";

let deviceConnection: DeviceConnection | null = null;
let deviceClient: DeviceClient | null = null;

function clearTerminal() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function cancelled<T>(value: T | symbol): value is symbol {
  return isCancel(value) && isBackNavigation(value);
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

async function connectWallet() {
  const ports = await listSerialPorts();
  if (ports.length === 0) {
    console.log("No serial devices detected. Connect the ESP32 and try again.");
    return;
  }
  const selected = await select({
    message: "Select USB wallet",
    options: ports.map((port) => ({
      value: port.path,
      label: port.path,
      hint: [port.manufacturer, port.serialNumber, port.productId].filter(Boolean).join(" | ") || "serial device",
    })),
  });
  if (cancelled(selected)) return;

  deviceConnection?.close();
  deviceConnection = await connectDevice(selected);
  deviceClient = new DeviceClient(deviceConnection);
  const info = await deviceClient.info();
  console.log(`\nWallet connected: ${deviceConnection.path}`);
  console.log(`Firmware: ${info.firmware} | ${info.chip} | ${info.cores} cores`);
}

async function walletDashboard() {
  console.log("MelodyPay Wallet Dashboard\n");
  if (!deviceClient) {
    console.log("No USB wallet connected.");
    console.log("Open USB wallet manager from the operator menu to connect one.");
    return;
  }
  const loader = spinner();
  loader.start("Reading wallet address and chain balances");
  try {
    const { address } = await deviceClient.address();
    const rows = await loadBalanceRows(address);
    loader.stop("Wallet balances loaded");
    console.log(`Address: ${address}`);
    console.log(`Device:  ${deviceConnection?.path ?? "disconnected"}`);
    console.log("\n" + formatBalanceRows(rows));
    console.log("\nToken registry: no verified ERC-20 tokens configured.");
    console.log("Add verified token metadata to CLI_TOKENS in cli/src/chains.ts to show token balances.");
  } catch (error) {
    loader.stop("Dashboard unavailable", 1);
    console.error(error instanceof Error ? error.message : error);
  }
}

function printDeviceStatus(status: Awaited<ReturnType<DeviceClient["status"]>>) {
  console.log(`\nWallet state: ${status.wallet_state}`);
  console.log(`Active chain: ${status.active_chain_id || "not configured"}`);
  console.log(`Signing:      ${status.signing ? "ready" : "unavailable"}`);
  console.log(`Address:      ${status.address_derivation ? "ready" : "unavailable"}`);
  console.log(`Display:      ${status.display_connected ? "connected" : "unavailable"}`);
  console.log(`Audio:        ${status.audio_available ? "available" : "unavailable"}`);
}

async function deviceManager() {
  for (;;) {
    const action = await select({
      message: deviceConnection ? `USB wallet connected (${deviceConnection.path})` : "USB wallet manager",
      options: [
        { value: "connect", label: deviceConnection ? "Reconnect wallet" : "Connect wallet" },
        { value: "status", label: "Show device status" },
        { value: "configure", label: "Configure active chain" },
        { value: "disconnect", label: "Disconnect wallet" },
        { value: "back", label: "Back" },
      ],
    });
    if (cancelled(action) || action === "back") return;
    try {
      if (action === "connect") await connectWallet();
      if (action === "status") {
        if (!deviceClient) throw new Error("Connect a wallet first");
        printDeviceStatus(await deviceClient.status());
      }
      if (action === "configure") {
        if (!deviceClient) throw new Error("Connect a wallet first");
        const chainId = await chooseChain();
        if (chainId !== null) console.log(JSON.stringify(await deviceClient.configureChain(chainId), null, 2));
      }
      if (action === "disconnect") {
        await deviceClient?.close();
        deviceClient = null;
        deviceConnection = null;
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  }
}

async function deviceStatus() {
  if (!deviceClient) {
    console.log("No USB wallet connected.");
    return;
  }
  try {
    console.log(`\nConnection: ${deviceConnection?.path ?? "disconnected"}`);
    printDeviceStatus(await deviceClient.status());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

async function diagnostics() {
  if (!deviceClient) {
    console.log("Connect a USB wallet first.");
    return;
  }
  const action = await select({
    message: "Device diagnostics",
    options: [
      { value: "audio", label: "Run audio self-test" },
      { value: "ggwave", label: "Run ggwave self-test" },
      { value: "button", label: "Test approval button" },
      { value: "display", label: "Show text on OLED" },
      { value: "back", label: "Back" },
    ],
  });
  if (cancelled(action) || action === "back") return;
  try {
    if (action === "audio") console.log(await deviceClient.audioSelfTest());
    if (action === "ggwave") console.log(await deviceClient.ggwaveSelfTest());
    if (action === "button") {
      const timeout = await text({ message: "Approval timeout in seconds", initialValue: "10" });
      if (!cancelled(timeout)) {
        console.log("Press GPIO10 now...");
        console.log(await deviceClient.waitForApproval(Number(timeout)));
      }
    }
    if (action === "display") {
      const textValue = await requiredText("OLED text", "MelodyPay");
      if (textValue) console.log(await deviceClient.displayText(textValue));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

async function main() {
  intro("MelodyPay Receiver CLI | keyless operator terminal");
  clearTerminal();
  await walletDashboard();

  for (;;) {
    clearTerminal();
    const action = await select<Action>({
      message: "Operator menu",
      options: [
        { value: "dashboard", label: "Dashboard", hint: "show current receiver and wallet state" },
        { value: "device", label: "USB wallet manager", hint: "connect, configure, disconnect" },
        { value: "status", label: "Wallet/device status" },
        { value: "payment", label: "Payment terminal", hint: "create request, validate, broadcast" },
        { value: "diagnostics", label: "Audio/OLED diagnostics" },
        { value: "inspect", label: "Inspect signed transaction", hint: "offline parsing only" },
        { value: "networks", label: "Network profiles", hint: "show configured EVM chains" },
        { value: "exit", label: "Exit" },
      ],
    });
    if (cancelled(action) || action === "exit") break;

    if (action === "dashboard") {
      await walletDashboard();
    }
    if (action === "device") await deviceManager();
    if (action === "status") await deviceStatus();
    if (action === "payment") await paymentTerminal();
    if (action === "diagnostics") await diagnostics();
    if (action === "inspect") await inspectTransaction();
    if (action === "networks") showNetworks();

  }

  outro("MelodyPay receiver stopped");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
