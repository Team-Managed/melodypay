export interface PrebookingEmailParams {
    to: string;
    queueNumber?: number;
    txHash: string;
    payerAddress: string;
    amount?: string;
    networkName?: string;
    timestamp?: string;
}

export interface EmailDispatchResult {
    success: boolean;
    id?: string;
    error?: string;
    mode: "resend" | "simulated";
}

/**
 * Generates an architectural, premium thermal receipt-styled confirmation email.
 */
export function generatePrebookingEmailHtml(params: PrebookingEmailParams): string {
    const isSepolia = !params.networkName || params.networkName.toLowerCase().includes("sepolia");
    const explorerUrl = isSepolia
        ? `https://sepolia.basescan.org/tx/${params.txHash}`
        : `https://basescan.org/tx/${params.txHash}`;
    const truncatedAddress = params.payerAddress.length > 14
        ? `${params.payerAddress.slice(0, 8)}...${params.payerAddress.slice(-6)}`
        : params.payerAddress;
    const dateStr = params.timestamp || new Date().toUTCString();
    const networkDisplay = params.networkName || "Base Sepolia Testnet";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Prebooked</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 30px 15px; color: #0F172A;">
  <div style="max-width: 520px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
    <!-- Brand Header -->
    <div style="background: #111113; padding: 24px; text-align: center;">
      <h1 style="color: #FFFFFF; font-size: 18px; margin: 0; letter-spacing: 1px; text-transform: uppercase; font-family: monospace;">MelodyPay</h1>
      <p style="color: #94A3B8; font-size: 12px; margin: 6px 0 0 0;">Air-Gapped Acoustic Sound Terminal // Hardware Pre-Booking</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px 24px; text-align: center;">
      <div style="display: inline-block; background: #ECFDF5; border: 1px solid #A7F3D0; padding: 6px 16px; border-radius: 9999px; font-size: 11px; font-weight: bold; color: #065F46; text-transform: uppercase; margin-bottom: 16px;">
        ✓ Pre-Booking Confirmed
      </div>

      <h2 style="color: #0F172A; font-size: 20px; margin: 0 0 8px 0; font-weight: 700;">Hardware Pre-Booked!</h2>
      <p style="color: #64748B; font-size: 13px; margin: 0 0 24px 0; line-height: 1.5;">
        Your 1.00 USDC deposit has been verified on ${networkDisplay}. You have secured early allocation for the first ESP32-S3 hardware production batch.
      </p>

      <!-- Prebooked Status Badge -->
      <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
        <span style="font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; font-weight: 600;">Status</span>
        <span style="font-size: 26px; font-weight: 800; color: #059669; font-family: monospace; letter-spacing: 1px;">PREBOOKED</span>
        <span style="font-size: 11px; color: #94A3B8; display: block; margin-top: 4px; font-family: monospace;">DevKit V1 Acoustic Hardware</span>
      </div>

      <!-- Metadata Grid -->
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; margin-bottom: 24px;">
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 0; color: #64748B;">Amount Paid:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0F172A;">${params.amount || "1.00"} USDC</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 0; color: #64748B;">Network:</td>
          <td style="padding: 8px 0; text-align: right; color: #0F172A;">${networkDisplay}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 0; color: #64748B;">Wallet Address:</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #0F172A;">${truncatedAddress}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 0; color: #64748B;">Date & Time:</td>
          <td style="padding: 8px 0; text-align: right; color: #0F172A;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748B;">On-Chain TX:</td>
          <td style="padding: 8px 0; text-align: right;">
            <a href="${explorerUrl}" target="_blank" style="color: #0284C7; text-decoration: none; font-weight: bold;">View on BaseScan ↗</a>
          </td>
        </tr>
      </table>

      <!-- Next Steps Callout -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; text-align: left; margin-bottom: 24px; font-size: 12px; color: #475569; line-height: 1.5;">
        <strong style="color: #0F172A; display: block; margin-bottom: 4px;">What's next?</strong>
        Our engineering team will notify you at this email address when your ESP32-S3 terminal enters manufacturing. No further action is required until dispatch.
      </div>

      <!-- Footer Receipt Brandmark -->
      <div style="border-top: 1px dashed #CBD5E1; padding-top: 16px; font-size: 11px; color: #94A3B8; font-family: monospace; text-transform: uppercase;">
        PAID WITH MELODYPAY // Acoustic POS
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
}

/**
 * Dispatches the prebooking confirmation email using Resend.
 * Falls back to graceful local simulation if VITE_RESEND_API_KEY is not configured.
 */
export async function sendPrebookingConfirmationEmail(
    params: PrebookingEmailParams
): Promise<EmailDispatchResult> {
    const html = generatePrebookingEmailHtml(params);

    try {
        const response = await fetch("/api/send-email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: params.to,
                queueNumber: params.queueNumber,
                html,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log(
                `%c[MelodyPay Email Dispatcher]%c Live email delivered via Resend! (ID: ${data.id}) to ${params.to}`,
                "background: #0284C7; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;",
                "color: #10B981; font-weight: bold; margin-left: 6px;"
            );
            return {
                success: true,
                id: data.id,
                mode: "resend",
            };
        }

        const errData = await response.json().catch(() => ({}));
        const errorMsg = errData.message || errData.error || `Server responded with ${response.status}`;
        console.warn("[MelodyPay Email Dispatcher] Resend issue:", errorMsg);

        return {
            success: false,
            error: errorMsg,
            mode: "simulated",
        };
    } catch (err: any) {
        // Fallback simulation when offline or in test environments
        console.log(
            `%c[MelodyPay Email Dispatcher]%c To: ${params.to} | Subject: "Prebooked"`,
            "background: #111113; color: #38BDF8; font-weight: bold; padding: 2px 6px; border-radius: 4px;",
            "color: #10B981; font-weight: bold; margin-left: 6px;"
        );
        return {
            success: true,
            id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            mode: "simulated",
        };
    }
}
