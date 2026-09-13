import { describe, it, expect } from "vitest";
import { generatePrebookingEmailHtml, sendPrebookingConfirmationEmail } from "../receiver-web/src/core/email";

describe("Pre-Booking Email Dispatcher", () => {
    it("generates branded HTML with subject Prebooked and queue number", () => {
        const html = generatePrebookingEmailHtml({
            to: "alice@example.com",
            queueNumber: 42,
            txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            payerAddress: "0x36aF09d2208E8A91C2e3E2FdfbB9aC1D183c509A",
            amount: "1.00",
            networkName: "Base Sepolia Testnet",
        });

        expect(html).toContain("PREBOOKED");
        expect(html).toContain("1.00 USDC");
        expect(html).toContain("Base Sepolia Testnet");
        expect(html).toContain("0xabcdef1234");
        expect(html).toContain("PAID WITH MELODYPAY");
    });

    it("dispatches in simulation mode when API key is missing without throwing", async () => {
        const result = await sendPrebookingConfirmationEmail({
            to: "alice@example.com",
            queueNumber: 1,
            txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            payerAddress: "0xA11CE",
        });

        expect(result.success).toBe(true);
        expect(result.mode).toBe("simulated");
        expect(result.id).toBeDefined();
    });
});
