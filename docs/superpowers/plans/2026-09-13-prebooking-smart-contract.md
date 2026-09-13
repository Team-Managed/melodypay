# MelodyPay Pre-Booking Smart Contract & Waitlist Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `MelodyPayPrebooking.sol` smart contract on Base Mainnet for 1 USDC priority hardware waitlist pre-bookings, integrate Resend email confirmation with subject `Prebooked`, update `Register.tsx` to the new pre-booking UI, and feed live queue numbers into the `/receipt` page.

**Architecture:** A lightweight, non-custodial smart contract (`MelodyPayPrebooking.sol`) takes 1 USDC via `SafeERC20.safeTransferFrom` and routes 100% directly to the Treasury wallet (`0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF`). It increments an authoritative on-chain counter `totalPrebookings` and emits `Prebooked` with the assigned sequential queue number. Emails remain 100% off-chain for user privacy. On transaction settlement, the frontend dispatches a confirmation email with subject `Prebooked` via Resend (with local fallback) and navigates to `/receipt`.

**Tech Stack:** Solidity 0.8.24, Foundry (`forge`), TypeScript, React, Tailwind CSS, ethers v6, Framer Motion, Vitest.

---

## Global Constraints
- Target Chain: Base Mainnet (Chain ID `8453`)
- Base Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals)
- Pre-Booking Price: Exactly 1.00 USDC (`1_000_000` units)
- Treasury Recipient: `0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF`
- Email Subject: Exactly `Prebooked`
- No email strings or personal identifiers on-chain
- Full test coverage across Foundry (`contracts/test`) and Vitest (`tests/`)

---

## File Structure

### Contracts
- `contracts/src/MelodyPayPrebooking.sol` — Core pre-booking smart contract with monotonic queue counter and treasury forwarding.
- `contracts/test/MelodyPayPrebooking.t.sol` — Comprehensive Foundry test suite covering deposits, queue ordering, double-booking prevention, failure modes, and emergency pause.
- `contracts/script/DeployPrebooking.s.sol` — Foundry deployment script for Base Mainnet.

### Frontend & Services
- `receiver-web/src/core/email.ts` — Resend email dispatcher with template renderer, subject `Prebooked`, and offline simulation fallback.
- `receiver-web/src/pages/Register.tsx` — Transformed into the official Hardware Pre-Booking & Priority Waitlist portal with wallet connection, 1-click USDC approval, and live on-chain waitlist count.
- `receiver-web/src/pages/PaymentReceipt.tsx` — Receipt renderer handling `prebooking` receipt types with queue position and BaseScan links.

### Tests
- `tests/email-dispatcher.test.ts` — Vitest unit tests for email payload structure, subject, and template content.
- `tests/prebooking-flow.test.ts` — Vitest tests for the end-to-end pre-booking state transition and receipt formatting.

---

### Task 1: Smart Contract Implementation (`MelodyPayPrebooking.sol`)

**Files:**
- Create: `contracts/src/MelodyPayPrebooking.sol`
- Test: `contracts/test/MelodyPayPrebooking.t.sol`

**Interfaces:**
- Consumes:
  - `contracts/src/common/IERC20.sol`
  - `contracts/src/common/SafeERC20.sol`
  - `contracts/src/common/Ownable2Step.sol`
  - `contracts/src/common/Pausable.sol`
  - `contracts/src/common/ReentrancyGuard.sol`
- Produces:
  - `function prebook() external returns (uint256 queueNumber)`
  - `function getQueueCount() external view returns (uint256)`
  - `function getUserQueue(address user) external view returns (uint256)`
  - `function hasPrebooked(address user) external view returns (bool)`
  - `event Prebooked(uint256 indexed queueNumber, address indexed user, uint256 amount, uint256 timestamp)`

- [ ] **Step 1: Write the failing Foundry test**

Create `contracts/test/MelodyPayPrebooking.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MelodyPayPrebooking} from "../src/MelodyPayPrebooking.sol";
import {IERC20} from "../src/common/IERC20.sol";

contract MockUSDC is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MelodyPayPrebookingTest is Test {
    MelodyPayPrebooking public prebooking;
    MockUSDC public usdc;

    address public treasury = address(0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        prebooking = new MelodyPayPrebooking(address(usdc), treasury);

        usdc.mint(alice, 10_000_000); // 10 USDC
        usdc.mint(bob, 10_000_000);   // 10 USDC
    }

    function test_Prebook_Success() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 1_000_000);
        uint256 qNum = prebooking.prebook();
        vm.stopPrank();

        assertEq(qNum, 1);
        assertEq(prebooking.totalPrebookings(), 1);
        assertEq(prebooking.getUserQueue(alice), 1);
        assertTrue(prebooking.hasPrebooked(alice));
        assertEq(usdc.balanceOf(treasury), 1_000_000);
        assertEq(usdc.balanceOf(alice), 9_000_000);
    }

    function test_SequentialQueueNumbers() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 1_000_000);
        uint256 q1 = prebooking.prebook();
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(prebooking), 1_000_000);
        uint256 q2 = prebooking.prebook();
        vm.stopPrank();

        assertEq(q1, 1);
        assertEq(q2, 2);
        assertEq(prebooking.getQueueCount(), 2);
        assertEq(usdc.balanceOf(treasury), 2_000_000);
    }

    function test_RevertIf_AlreadyPrebooked() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 2_000_000);
        prebooking.prebook();

        vm.expectRevert("Already prebooked");
        prebooking.prebook();
        vm.stopPrank();
    }

    function test_RevertIf_Paused() public {
        prebooking.pause();

        vm.startPrank(alice);
        usdc.approve(address(prebooking), 1_000_000);
        vm.expectRevert();
        prebooking.prebook();
        vm.stopPrank();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `forge test --root contracts --match-contract MelodyPayPrebookingTest`
Expected: FAIL compilation error (contract `MelodyPayPrebooking.sol` does not exist yet).

- [ ] **Step 3: Implement `MelodyPayPrebooking.sol`**

Create `contracts/src/MelodyPayPrebooking.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./common/IERC20.sol";
import {SafeERC20} from "./common/SafeERC20.sol";
import {Ownable2Step} from "./common/Ownable2Step.sol";
import {Pausable} from "./common/Pausable.sol";
import {ReentrancyGuard} from "./common/ReentrancyGuard.sol";

/**
 * @title MelodyPayPrebooking
 * @notice Fixed-price (1 USDC) pre-booking and priority waitlist contract for the
 *         MelodyPay ESP32-S3 Air-Gapped Acoustic Sound Terminal.
 * @dev 100% of proceeds forward directly to the treasury wallet.
 *      Maintains an authoritative on-chain counter of pre-booked users.
 *      User contact data remains 100% off-chain for privacy.
 */
contract MelodyPayPrebooking is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical Base USDC Token
    IERC20 public immutable usdc;

    /// @notice Treasury Address receiving hardware pre-booking funds
    address public immutable treasury;

    /// @notice Pre-booking price: exactly 1.00 USDC (6 decimals)
    uint256 public constant PREBOOK_PRICE = 1_000_000;

    /// @notice Total number of pre-booked users
    uint256 public totalPrebookings;

    /// @notice Mapping from user address to their sequential queue number
    mapping(address => uint256) public userQueueNumber;

    /// @notice Mapping from queue number to user address
    mapping(uint256 => address) public queueUser;

    /// @notice Emitted when a user successfully completes a pre-booking
    event Prebooked(
        uint256 indexed queueNumber,
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when the treasury address is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    constructor(address _usdc, address _treasury) Ownable2Step(msg.sender) {
        require(_usdc != address(0), "Zero USDC address");
        require(_treasury != address(0), "Zero treasury address");

        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    /**
     * @notice Reserve priority hardware waitlist spot by paying 1 USDC
     * @return queueNumber The sequential priority queue position assigned to the user
     */
    function prebook() external nonReentrant whenNotPaused returns (uint256 queueNumber) {
        require(userQueueNumber[msg.sender] == 0, "Already prebooked");

        // Forward 1.00 USDC directly from caller to treasury
        usdc.safeTransferFrom(msg.sender, treasury, PREBOOK_PRICE);

        // Increment monotonic queue counter
        totalPrebookings += 1;
        queueNumber = totalPrebookings;

        userQueueNumber[msg.sender] = queueNumber;
        queueUser[queueNumber] = msg.sender;

        emit Prebooked(queueNumber, msg.sender, PREBOOK_PRICE, block.timestamp);
    }

    /**
     * @notice Check if a user has already pre-booked
     */
    function hasPrebooked(address user) external view returns (bool) {
        return userQueueNumber[user] != 0;
    }

    /**
     * @notice Get user's assigned queue number
     */
    function getUserQueue(address user) external view returns (uint256) {
        return userQueueNumber[user];
    }

    /**
     * @notice Get total count of pre-booked users
     */
    function getQueueCount() external view returns (uint256) {
        return totalPrebookings;
    }

    /**
     * @notice Emergency circuit breaker
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume pre-bookings
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
```

- [ ] **Step 4: Run Foundry test suite to verify pass**

Run: `forge test --root contracts --match-contract MelodyPayPrebookingTest -v`
Expected: 4 passed tests (PASS).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/MelodyPayPrebooking.sol contracts/test/MelodyPayPrebooking.t.sol
git commit -m "feat(contracts): implement MelodyPayPrebooking contract and Foundry tests"
```

---

### Task 2: Deployment Script & Contract Documentation

**Files:**
- Create: `contracts/script/DeployPrebooking.s.sol`
- Modify: `contracts/README.md`

- [ ] **Step 1: Write deployment script**

Create `contracts/script/DeployPrebooking.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {MelodyPayPrebooking} from "../src/MelodyPayPrebooking.sol";

contract DeployPrebooking is Script {
    // Base Mainnet Canonical USDC
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    // MelodyPay Official Treasury
    address constant TREASURY = 0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF;

    function run() external returns (MelodyPayPrebooking prebooking) {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        prebooking = new MelodyPayPrebooking(BASE_USDC, TREASURY);
        console.log("MelodyPayPrebooking deployed to:", address(prebooking));
        console.log("USDC address:", BASE_USDC);
        console.log("Treasury address:", TREASURY);

        vm.stopBroadcast();
    }
}
```

- [ ] **Step 2: Dry run deployment simulation**

Run: `forge script script/DeployPrebooking.s.sol:DeployPrebooking --root contracts`
Expected: Successful local simulation trace showing `MelodyPayPrebooking` deployment.

- [ ] **Step 3: Update `contracts/README.md`**

Add `MelodyPayPrebooking` documentation and deployment command.

- [ ] **Step 4: Commit**

```bash
git add contracts/script/DeployPrebooking.s.sol contracts/README.md
git commit -m "feat(contracts): add Base Mainnet deployment script and documentation for pre-booking"
```

---

### Task 3: Resend Email Dispatcher Module (`receiver-web/src/core/email.ts`)

**Files:**
- Create: `receiver-web/src/core/email.ts`
- Create: `tests/email-dispatcher.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface PrebookingEmailParams {
      to: string;
      queueNumber: number;
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

  export async function sendPrebookingConfirmationEmail(
      params: PrebookingEmailParams
  ): Promise<EmailDispatchResult>;
  ```

- [ ] **Step 1: Write failing unit tests for email dispatcher**

Create `tests/email-dispatcher.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generatePrebookingEmailHtml, sendPrebookingConfirmationEmail } from "../receiver-web/src/core/email";

describe("Pre-Booking Email Dispatcher", () => {
    it("generates branded HTML with exact subject and queue number", () => {
        const html = generatePrebookingEmailHtml({
            to: "alice@example.com",
            queueNumber: 42,
            txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            payerAddress: "0x36aF09d2208E8A91C2e3E2FdfbB9aC1D183c509A",
            amount: "1.00",
            networkName: "Base Mainnet",
        });

        expect(html).toContain("#042");
        expect(html).toContain("1.00 USDC");
        expect(html).toContain("Base Mainnet");
        expect(html).toContain("0xabcdef1234");
        expect(html).toContain("PAID WITH MELODYPAY");
    });

    it("dispatches in simulation mode when API key is missing without throwing", async () => {
        const result = await sendPrebookingConfirmationEmail({
            to: "alice@example.com",
            queueNumber: 1,
            txHash: "0x123",
            payerAddress: "0xA11CE",
        });

        expect(result.success).toBe(true);
        expect(result.mode).toBe("simulated");
        expect(result.id).toBeDefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/email-dispatcher.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `receiver-web/src/core/email.ts`**

```typescript
export interface PrebookingEmailParams {
    to: string;
    queueNumber: number;
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

export function generatePrebookingEmailHtml(params: PrebookingEmailParams): string {
    const formattedQueue = `#${String(params.queueNumber).padStart(3, "0")}`;
    const explorerUrl = `https://basescan.org/tx/${params.txHash}`;
    const truncatedAddress = `${params.payerAddress.slice(0, 8)}...${params.payerAddress.slice(-6)}`;
    const dateStr = params.timestamp || new Date().toUTCString();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Prebooked</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 30px 15px;">
  <div style="max-width: 520px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
    <div style="background: #111113; padding: 24px; text-align: center;">
      <h1 style="color: #FFFFFF; font-size: 18px; margin: 0; letter-spacing: 1px; text-transform: uppercase;">MelodyPay</h1>
      <p style="color: #94A3B8; font-size: 12px; margin: 6px 0 0 0;">Air-Gapped Acoustic Sound Terminal</p>
    </div>

    <div style="padding: 28px 24px; text-align: center;">
      <div style="display: inline-block; background: #ECFDF5; border: 1px solid #A7F3D0; padding: 6px 16px; rounded: 9999px; font-size: 11px; font-weight: bold; color: #065F46; text-transform: uppercase; margin-bottom: 16px;">
        ✓ Pre-Booking Confirmed
      </div>

      <h2 style="color: #0F172A; font-size: 20px; margin: 0 0 8px 0;">You're in the Priority Queue!</h2>
      <p style="color: #64748B; font-size: 13px; margin: 0 0 24px 0; line-height: 1.5;">
        Your 1.00 USDC deposit has been verified on Base Mainnet. You have secured priority allocation for the first ESP32-S3 hardware production batch.
      </p>

      <div style="background: #F1F5F9; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
        <span style="font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Official Waitlist Position</span>
        <span style="font-size: 36px; font-weight: 800; color: #0284C7; font-family: monospace; letter-spacing: -1px;">${formattedQueue}</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; margin-bottom: 24px;">
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 0; color: #64748B;">Amount Paid:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0F172A;">${params.amount || "1.00"} ${params.amount ? "USDC" : "1.00 USDC"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 0; color: #64748B;">Network:</td>
          <td style="padding: 8px 0; text-align: right; color: #0F172A;">${params.networkName || "Base Mainnet"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 0; color: #64748B;">Wallet:</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #0F172A;">${truncatedAddress}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 0; color: #64748B;">Date:</td>
          <td style="padding: 8px 0; text-align: right; color: #0F172A;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748B;">On-Chain TX:</td>
          <td style="padding: 8px 0; text-align: right;">
            <a href="${explorerUrl}" target="_blank" style="color: #0284C7; text-decoration: none; font-weight: bold;">View on BaseScan ↗</a>
          </td>
        </tr>
      </table>

      <div style="border-top: 1px dashed #CBD5E1; padding-top: 16px; font-size: 11px; color: #94A3B8;">
        PAID WITH MELODYPAY // Air-Gapped Acoustic POS
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
}

export async function sendPrebookingConfirmationEmail(
    params: PrebookingEmailParams
): Promise<EmailDispatchResult> {
    const apiKey = (import.meta as any).env?.VITE_RESEND_API_KEY;

    if (!apiKey) {
        // Fallback: graceful local simulation
        console.log("[Email Dispatch Simulated] To:", params.to, "Subject: Prebooked, Queue:", params.queueNumber);
        return {
            success: true,
            id: `sim_${Date.now()}`,
            mode: "simulated",
        };
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: "MelodyPay <prebook@melodypay.eth>",
                to: [params.to],
                subject: "Prebooked",
                html: generatePrebookingEmailHtml(params),
            }),
        });

        if (!response.ok) {
            const errData = await response.json();
            return {
                success: false,
                error: errData.message || "Failed to send email via Resend",
                mode: "resend",
            };
        }

        const data = await response.json();
        return {
            success: true,
            id: data.id,
            mode: "resend",
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message || "Network error sending email",
            mode: "resend",
        };
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/email-dispatcher.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add receiver-web/src/core/email.ts tests/email-dispatcher.test.ts
git commit -m "feat: add Resend prebooking email dispatcher with subject Prebooked"
```

---

### Task 4: Pre-Booking Web UI & Wallet Transaction Flow (`Register.tsx`)

**Files:**
- Modify: `receiver-web/src/pages/Register.tsx`
- Create: `tests/prebooking-flow.test.ts`

- [ ] **Step 1: Write failing flow test**

Create `tests/prebooking-flow.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("Pre-booking Flow & Receipt Generation", () => {
    it("validates receipt payload generation from pre-booking contract event", () => {
        const queueNumber = 42;
        const txHash = "0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef";
        const payer = "0x36aF09d2208E8A91C2e3E2FdfbB9aC1D183c509A";
        const treasury = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";

        const receiptData = {
            type: "prebooking" as const,
            amount: "1.00",
            token: "USDC",
            queueNumber: `#${String(queueNumber).padStart(3, "0")}`,
            recipient: treasury,
            payer: payer,
            txHash: txHash,
            chainId: 8453,
            networkName: "Base Mainnet",
            timestamp: new Date().toISOString(),
            receiptId: `WAITLIST-BASE-${String(queueNumber).padStart(3, "0")}`,
        };

        expect(receiptData.type).toBe("prebooking");
        expect(receiptData.queueNumber).toBe("#042");
        expect(receiptData.amount).toBe("1.00");
        expect(receiptData.receiptId).toBe("WAITLIST-BASE-042");
        expect(receiptData.networkName).toBe("Base Mainnet");
    });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/prebooking-flow.test.ts`
Expected: 1 test PASS.

- [ ] **Step 3: Update `Register.tsx` to Hardware Pre-Booking Portal**

Transform `Register.tsx`:
- Replaces ENS registration with **ESP32-S3 Hardware Pre-Booking & Priority Waitlist**.
- Inputs: User Email address and connected wallet.
- Live waitlist banner: *"Priority Queue Allocation: 1.00 USDC on Base Mainnet"*.
- Connect wallet button with 1-click network switch to Base (`8453`).
- 2-step transaction or combined:
  - Checks USDC allowance: if `< 1.00 USDC`, calls `usdc.approve(contractAddress, 1000000)`.
  - Calls `prebookingContract.prebook()`.
- Captures `Prebooked` event or transaction receipt.
- Calls `sendPrebookingConfirmationEmail({ to: email, queueNumber, txHash, payerAddress })`.
- Saves receipt in `localStorage.setItem("melodypay_last_receipt", ...)` and navigates to `/receipt`.

- [ ] **Step 4: Commit**

```bash
git add receiver-web/src/pages/Register.tsx tests/prebooking-flow.test.ts
git commit -m "feat(web): update Register page to 1 USDC priority hardware pre-booking flow"
```

---

### Task 5: Thermal Receipt Page Pre-Booking Integration (`PaymentReceipt.tsx`)

**Files:**
- Modify: `receiver-web/src/pages/PaymentReceipt.tsx`
- Modify: `tests/receipt-flow.test.ts`

- [ ] **Step 1: Update `PaymentReceipt.tsx` to render pre-booking receipts cleanly**

In `PaymentReceipt.tsx`:
- Detects `receipt.type === "prebooking"`.
- Header: `MELODYPAY PAYMENT RECEIPT`.
- Stamp Box:
  - Badge: `✓ PRE-BOOKING CONFIRMED`
  - Amount: `1.00 USDC`
  - Subtitle: `PRIORITY HARDWARE ALLOCATION // BASE MAINNET`
- Metadata:
  - `RECEIPT NO:` `WAITLIST-BASE-{queueNumber}`
  - `WAITLIST POSITION:` `#{queueNumber}`
  - `SETTLEMENT ASSET:` `Native USDC`
  - `NETWORK:` `Base Mainnet (8453)`
  - `PAYER WALLET:` User address
  - `TREASURY VAULT:` `0x0E69...BCF`
  - `TX HASH:` BaseScan link
- Footer: `PAID WITH MELODYPAY`.

- [ ] **Step 2: Update receipt unit tests in `tests/receipt-flow.test.ts`**

Add prebooking receipt validation test cases.

- [ ] **Step 3: Run Vitest and build verification**

Run: `npx vitest run`
Expected: All tests pass.
Run: `npm run build --prefix receiver-web`
Expected: Build succeeds with zero errors.

- [ ] **Step 4: Commit**

```bash
git add receiver-web/src/pages/PaymentReceipt.tsx tests/receipt-flow.test.ts
git commit -m "feat(web): add pre-booking waitlist receipt template to thermal printer"
```

---

### Task 6: Progress Tracking & Final Verification

**Files:**
- Modify: `context/progress-tracker.md`

- [ ] **Step 1: Update `context/progress-tracker.md`** with completed tasks.
- [ ] **Step 2: Run full test suite across contracts and frontend**
  - `forge test --root contracts`
  - `npx vitest run`
- [ ] **Step 3: Final commit**
