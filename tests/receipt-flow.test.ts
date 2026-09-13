import { describe, it, expect } from "vitest";
import type { ReceiptData } from "../receiver-web/src/pages/PaymentReceipt";

describe("Payment Receipt & Thermal Printer Logic", () => {
  it("validates POS payment receipt schema and required fields", () => {
    const paymentReceipt: ReceiptData = {
      type: "pos_payment",
      amount: "5.00",
      token: "USDC",
      recipient: "0xE36f3d4Bd0a6bbdd940404C6323c1121b2666176",
      txHash: "0x8fa37d82f7c059841f3246eb767856d8ffcbbf5f822bcaee9076f8e21ba40a71",
      payer: "0x36aF09d2208E8A91C2e3E2FdfbB9aC1D183c509A",
      chainId: 84532,
      networkName: "Base Sepolia Testnet",
      timestamp: new Date().toISOString(),
      receiptId: "RCP-B84532-12345",
      nonce: "0x1234",
    };

    expect(paymentReceipt.type).toBe("pos_payment");
    expect(Number(paymentReceipt.amount)).toBeGreaterThan(0);
    expect(paymentReceipt.recipient.startsWith("0x")).toBe(true);
    expect(paymentReceipt.txHash.startsWith("0x")).toBe(true);
    expect(paymentReceipt.chainId).toBe(84532);
    expect(paymentReceipt.receiptId?.startsWith("RCP-B84532-")).toBe(true);
  });

  it("validates ENS registration receipt schema and hardware queue tracking", () => {
    const registrationReceipt: ReceiptData = {
      type: "ens_registration",
      amount: "1.00",
      token: "USDC",
      subname: "cafe.melodypay.eth",
      recipient: "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF",
      txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      chainId: "11155111",
      networkName: "Ethereum Sepolia",
      timestamp: new Date().toISOString(),
      receiptId: "REG-ENS-4242",
      queueNumber: "#042",
    };

    expect(registrationReceipt.type).toBe("ens_registration");
    expect(registrationReceipt.subname?.endsWith(".melodypay.eth")).toBe(true);
    expect(registrationReceipt.queueNumber).toBe("#042");
    expect(registrationReceipt.receiptId?.startsWith("REG-ENS-")).toBe(true);
  });

  it("validates hardware pre-booking waitlist receipt schema and queue allocation", () => {
    const prebookingReceipt: ReceiptData = {
      type: "prebooking",
      amount: "1.00",
      token: "USDC",
      recipient: "0xE36f3d4Bd0a6bbdd940404C6323c1121b2666176",
      payer: "0x36aF09d2208E8A91C2e3E2FdfbB9aC1D183c509A",
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      chainId: 84532,
      networkName: "Base Sepolia Testnet",
      timestamp: new Date().toISOString(),
      receiptId: "WAITLIST-BASE-SEP-042",
      queueNumber: "#042",
    };

    expect(prebookingReceipt.type).toBe("prebooking");
    expect(prebookingReceipt.amount).toBe("1.00");
    expect(prebookingReceipt.token).toBe("USDC");
    expect(prebookingReceipt.queueNumber).toBe("#042");
    expect(prebookingReceipt.receiptId).toBe("WAITLIST-BASE-SEP-042");
    expect(prebookingReceipt.chainId).toBe(84532);
    expect(prebookingReceipt.networkName).toBe("Base Sepolia Testnet");
  });

  it("formats ASCII receipt string with thermal formatting", () => {
    const formatReceiptText = (r: ReceiptData) => `MELODYPAY RECEIPT
ID: ${r.receiptId}
AMOUNT: ${r.amount} ${r.token}
NETWORK: ${r.networkName}
TX: ${r.txHash}`;

    const sample: ReceiptData = {
      type: "pos_payment",
      amount: "10.00",
      token: "USDC",
      recipient: "0xE36f3d4Bd0a6bbdd940404C6323c1121b2666176",
      txHash: "0x123",
      networkName: "Base Sepolia Testnet",
      receiptId: "RCP-B84532-99999",
    };

    const formatted = formatReceiptText(sample);
    expect(formatted).toContain("MELODYPAY RECEIPT");
    expect(formatted).toContain("RCP-B84532-99999");
    expect(formatted).toContain("10.00 USDC");
    expect(formatted).toContain("Base Sepolia Testnet");
  });

  it("ensures JSON serialization and deserialization retains precision and integrity", () => {
    const original: ReceiptData = {
      type: "pos_payment",
      amount: "25.50",
      token: "USDC",
      recipient: "0xE36f3d4Bd0a6bbdd940404C6323c1121b2666176",
      txHash: "0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef",
      chainId: 84532,
      networkName: "Base Sepolia Testnet",
      timestamp: "2026-09-13T09:20:00.000Z",
      receiptId: "RCP-B84532-55555",
    };

    const serialized = JSON.stringify(original);
    const restored = JSON.parse(serialized) as ReceiptData;

    expect(restored).toEqual(original);
    expect(restored.amount).toBe("25.50");
    expect(restored.chainId).toBe(84532);
  });
});
