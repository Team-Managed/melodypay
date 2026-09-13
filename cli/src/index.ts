import { ethers } from "ethers";
import { loadBalanceRows } from "./balances.js";
import { CLI_CHAINS } from "./chains.js";
import { getPaymentRequest, validateAndBroadcast } from "./receiver.js";
import { DeviceClient } from "./device.js";
import { connectDevice, listSerialPorts, type DeviceConnection } from "./serial.js";
import { promptSelect, promptText, runOperatorUi, showInfo, type DashboardSnapshot } from "./operator-ui.js";

type Action = "dashboard" | "device" | "status" | "networks" | "payment" | "diagnostics" | "inspect" | "exit";

let deviceConnection: DeviceConnection | null = null;
let deviceClient: DeviceClient | null = null;

async function requiredText(message: string, placeholder?: string): Promise<string | null> {
  return promptText(message, placeholder);
}

async function chooseChain(): Promise<number | null> {
  return promptSelect("Select network", CLI_CHAINS.map((chain) => ({
      value: chain.chainId,
      label: `${chain.name} (${chain.symbol})`,
      hint: `chain ${chain.chainId}`,
    })));
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

  try {
    const request = await getPaymentRequest(chainId, recipient, amount, sender);
    await showInfo("Payment request ready", JSON.stringify({
      ...request,
      maxFeePerGas: request.maxFeePerGas.toString(),
      maxPriorityFeePerGas: request.maxPriorityFeePerGas.toString(),
    }, null, 2) + "\n\nAudio adapter boundary: play this request to the hardware wallet.");

    const signed = await requiredText("Paste signed transaction", "0x...");
    if (!signed) return;
    const hash = await validateAndBroadcast(signed, request);
    await showInfo("Broadcast complete", `Transaction: ${hash}`);
  } catch (error) {
    await showInfo("Payment failed", error instanceof Error ? error.message : String(error));
  }
}

async function inspectTransaction() {
  const signed = await requiredText("Signed transaction", "0x...");
  if (!signed) return;
  try {
    const tx = ethers.Transaction.from(signed);
    await showInfo("Signed transaction", JSON.stringify({
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
    await showInfo("Invalid transaction", error instanceof Error ? error.message : String(error));
  }
}

async function showNetworks() {
  await showInfo("Network profiles", CLI_CHAINS.map((chain) =>
    `${chain.name.padEnd(20)} ${String(chain.chainId).padEnd(10)} ${chain.symbol}  ${chain.rpcUrl}`,
  ).join("\n"));
}

async function connectWallet() {
  const ports = await listSerialPorts();
  if (ports.length === 0) {
    await showInfo("USB wallet", "No serial devices detected. Connect the ESP32 and try again.");
    return;
  }
  const selected = await promptSelect("Select USB wallet", ports.map((port) => ({
      value: port.path,
      label: port.path,
      hint: [port.manufacturer, port.serialNumber, port.productId].filter(Boolean).join(" | ") || "serial device",
    })));
  if (!selected) return;

  deviceConnection?.close();
  deviceConnection = await connectDevice(selected);
  deviceClient = new DeviceClient(deviceConnection);
  const info = await deviceClient.info();
  await showInfo("Wallet connected", `${deviceConnection.path}\nFirmware: ${info.firmware} | ${info.chip} | ${info.cores} cores`);
}

async function loadDashboard(): Promise<DashboardSnapshot> {
  if (!deviceClient) {
    return { rows: [] };
  }
  try {
    const { address } = await deviceClient.address();
    const rows = await loadBalanceRows(address);
    return { address, devicePath: deviceConnection?.path, rows };
  } catch (error) {
    return {
      devicePath: deviceConnection?.path,
      rows: [{
        chain: "Dashboard",
        asset: "error",
        balance: error instanceof Error ? error.message : String(error),
        status: "error",
      }],
    };
  }
}

async function deviceManager() {
  for (;;) {
    const action = await promptSelect(
      deviceConnection ? `USB wallet connected (${deviceConnection.path})` : "USB wallet manager",
      [
        { value: "connect", label: deviceConnection ? "Reconnect wallet" : "Connect wallet" },
        { value: "status", label: "Show device status" },
        { value: "configure", label: "Configure active chain" },
        { value: "disconnect", label: "Disconnect wallet" },
        { value: "back", label: "Back" },
      ],
    );
    if (!action || action === "back") return;
    try {
      if (action === "connect") await connectWallet();
      if (action === "status") {
        if (!deviceClient) throw new Error("Connect a wallet first");
        const status = await deviceClient.status();
        await showInfo("Wallet status", statusLines(status));
      }
      if (action === "configure") {
        if (!deviceClient) throw new Error("Connect a wallet first");
        const chainId = await chooseChain();
        if (chainId !== null) await showInfo("Active chain configured", JSON.stringify(await deviceClient.configureChain(chainId), null, 2));
      }
      if (action === "disconnect") {
        await deviceClient?.close();
        deviceClient = null;
        deviceConnection = null;
      }
    } catch (error) {
      await showInfo("USB wallet error", error instanceof Error ? error.message : String(error));
    }
  }
}

async function deviceStatus() {
  if (!deviceClient) {
    await showInfo("Wallet status", "No USB wallet connected.");
    return;
  }
  try {
    const status = await deviceClient.status();
    await showInfo("Wallet status", `Connection: ${deviceConnection?.path ?? "disconnected"}\n` + statusLines(status));
  } catch (error) {
    await showInfo("Wallet status error", error instanceof Error ? error.message : String(error));
  }
}

function statusLines(status: Awaited<ReturnType<DeviceClient["status"]>>): string {
  return [
    `Wallet state: ${status.wallet_state}`,
    `Active chain: ${status.active_chain_id || "not configured"}`,
    `Signing:      ${status.signing ? "ready" : "unavailable"}`,
    `Address:      ${status.address_derivation ? "ready" : "unavailable"}`,
    `Display:      ${status.display_connected ? "connected" : "unavailable"}`,
    `Audio:        ${status.audio_available ? "available" : "unavailable"}`,
  ].join("\n");
}

async function diagnostics() {
  if (!deviceClient) {
    await showInfo("Diagnostics", "Connect a USB wallet first.");
    return;
  }
  const action = await promptSelect("Device diagnostics", [
      { value: "audio", label: "Run audio self-test" },
      { value: "ggwave", label: "Run ggwave self-test" },
      { value: "button", label: "Test approval button" },
      { value: "display", label: "Show text on OLED" },
      { value: "back", label: "Back" },
    ]);
  if (!action || action === "back") return;
  try {
    if (action === "audio") await showInfo("Audio self-test", JSON.stringify(await deviceClient.audioSelfTest(), null, 2));
    if (action === "ggwave") await showInfo("ggwave self-test", JSON.stringify(await deviceClient.ggwaveSelfTest(), null, 2));
    if (action === "button") {
      const timeout = await promptText("Approval timeout in seconds", "10");
      if (timeout) await showInfo("Approval button", `Press GPIO10 now.\n\n${JSON.stringify(await deviceClient.waitForApproval(Number(timeout)), null, 2)}`);
    }
    if (action === "display") {
      const textValue = await requiredText("OLED text", "MelodyPay");
      if (textValue) await showInfo("OLED display", JSON.stringify(await deviceClient.displayText(textValue), null, 2));
    }
  } catch (error) {
    await showInfo("Diagnostics error", error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  for (;;) {
    const action = await runOperatorUi(await loadDashboard());
    if (action === "exit") break;

    if (action === "dashboard") continue;
    if (action === "device") await deviceManager();
    if (action === "status") await deviceStatus();
    if (action === "payment") await paymentTerminal();
    if (action === "diagnostics") await diagnostics();
    if (action === "inspect") await inspectTransaction();
    if (action === "networks") await showNetworks();

  }

  console.log("MelodyPay receiver stopped");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
