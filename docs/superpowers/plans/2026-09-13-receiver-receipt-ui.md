# Receiver and Receipt UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing branch-inspired receiver presentation and animated multi-purpose receipt flow without changing current payment protocols.

**Architecture:** Keep `ReceivePayment.tsx` as the source of truth for multi-chain, ENS, Arc, and hardware-audio behavior. Add a typed `PaymentReceipt.tsx` route that owns the thermal-printer animation and accepts receipt data produced by `ReceivePayment` and `Register`. Add only route/data wiring around existing handlers; do not import branch-only audio, email, or simulated-transaction code.

**Tech Stack:** React 18, TypeScript, React Router, Framer Motion, Tailwind CSS, ethers v6, Vite, Vitest.

## Global Constraints

- The current multi-chain, ENS, Arc, and hardware-audio payment behavior remains authoritative.
- The receipt page supports both `pos_payment` and `prebooking` receipt types.
- Explorer URLs derive from `getChainConfig(receipt.chainId)` with explicit known-network fallbacks only.
- No Brevo, Resend, `/api/send-email`, client email key, simulated transaction hash, or fake settlement path may be added.
- `/receive`, `/register`, and `/receipt` must render through the existing app shell.
- Desktop uses two-column receiver composition; mobile collapses naturally without fixed-height clipping.

---

### Task 1: Add Typed Receipt Route

**Files:**
- Create: `receiver-web/src/pages/PaymentReceipt.tsx`
- Modify: `receiver-web/src/App.tsx:1-24`

**Interfaces:**
- Consumes: `ReceiptData` passed through React Router location state or `localStorage` key `melodypay_last_receipt`.
- Produces: `/receipt` route with animated thermal receipt UI and chain-aware explorer links.

- [ ] **Step 1: Define the receipt data contract**

Export this interface from `PaymentReceipt.tsx`:

```ts
export interface ReceiptData {
  type: "pos_payment" | "prebooking";
  amount: string;
  token: string;
  recipient: string;
  txHash: string;
  payer?: string;
  chainId?: number | string;
  networkName?: string;
  timestamp?: string;
  receiptId?: string;
  nonce?: string;
  quantity?: number;
}
```

- [ ] **Step 2: Implement refresh-safe receipt loading**

Read valid receipt data from `location.state` first, then `localStorage`. If neither exists, navigate to `/receive` with `replace: true`. Never fabricate a transaction hash or receipt data.

- [ ] **Step 3: Implement thermal printer animation**

Port the visual receipt treatment from `origin/feat/ui-ux` without its logic dependencies:

- Dark printer chassis with power/data/error LEDs.
- FEED button that replays the paper animation.
- Animated paper entering through the cutter slot.
- Receipt body with settlement status, amount/token, network, timestamp, recipient, payer, quantity, and transaction hash.
- Copy hash button and explorer link.
- `window.print()` action using print-only CSS for the receipt card.

Use `MelodyPayStaffRibbon` only if it remains a presentation-only background; do not add route or transaction logic to the component.

- [ ] **Step 4: Register the route**

Add:

```tsx
<Route path="/receipt" element={<PaymentReceipt />} />
```

### Task 2: Wire Prebooking Receipt Data

**Files:**
- Modify: `receiver-web/src/pages/Register.tsx:123-180`
- Consume: `receiver-web/src/pages/PaymentReceipt.tsx:ReceiptData`

**Interfaces:**
- Consumes: confirmed Base transaction receipt, wallet address, quantity, total price, and contract address.
- Produces: `ReceiptData` with `type: "prebooking"` and navigation to `/receipt`.

- [ ] **Step 1: Import navigation and receipt type**

Use `useNavigate` and `ReceiptData` without adding email code.

- [ ] **Step 2: Build and persist confirmed prebooking data**

After `transaction.wait(1)` returns, create:

```ts
const receiptData: ReceiptData = {
  type: "prebooking",
  amount: totalPrice,
  token: "USDC",
  recipient: contractAddress,
  txHash: receipt.hash,
  payer: wallet,
  chainId: BASE_CHAIN_ID,
  networkName: "Base Mainnet",
  timestamp: new Date().toISOString(),
  receiptId: `PREBOOK-BASE-${Date.now().toString().slice(-6)}`,
  quantity,
};
localStorage.setItem("melodypay_last_receipt", JSON.stringify(receiptData));
navigate("/receipt", { state: receiptData });
```

Keep the existing inline confirmation/status state until navigation and do not dispatch email.

### Task 3: Port Receiver Presentation and Receipt Wiring

**Files:**
- Modify: `receiver-web/src/pages/ReceivePayment.tsx:1-457`
- Consume: `receiver-web/src/pages/PaymentReceipt.tsx:ReceiptData`

**Interfaces:**
- Consumes: existing `step`, `status`, `recipientAddress`, `resolvedMerchantName`, `chain`, `amount`, `txHash`, and settlement callbacks.
- Produces: branch-inspired receiver UI and `pos_payment` receipt navigation for native and Arc settlement.

- [ ] **Step 1: Preserve payment handlers and add navigation only**

Do not replace `handleStart`, audio listeners, ENS resolution, Arc authorization validation, native transaction validation, or broadcast calls. Add `useNavigate` and a helper that stores/navigates a `ReceiptData` object after the existing `RECEIPT|` audio payload has been sent.

- [ ] **Step 2: Add the editorial receiver header**

Use the branch visual hierarchy:

```tsx
<span>// AIR-GAPPED ACOUSTIC POS TERMINAL</span>
<h1>Receive Sound Payments.<br /><span>Air-gapped acoustic wire. Settled on-chain.</span></h1>
<p>Broadcast ultrasound POS invoices and capture offline cryptographically signed payment authorizations through air-gapped acoustic audio.</p>
```

- [ ] **Step 3: Expand the payment terminal card**

Keep the existing ENS/address field, chain selector, amount field, and resolved merchant message. Add the branch's wallet/status strip, optional amount presets, stronger action copy, richer phase status card, error notice, and completed payment metadata. The completed state must offer `View receipt` and `Receive next payment` actions.

- [ ] **Step 4: Expand the telemetry/specification card**

Use `VibrantSoundBars` as the existing visual-only animation. Add live status labels derived from `step`, plus static Air-Gapped Payment Architecture facts. Do not add any new audio listener or network request.

- [ ] **Step 5: Wire native and Arc receipts**

After each existing successful settlement path has set the tx hash and emitted the receipt audio, create:

```ts
const receiptData: ReceiptData = {
  type: "pos_payment",
  amount,
  token: isArc ? "USDC" : chain.nativeSymbol,
  recipient: receiver,
  txHash: hash,
  payer: isArc ? validated.authorizer : (parsed.from ?? pending.sender),
  chainId: chain.chainId,
  networkName: chain.name,
  timestamp: new Date().toISOString(),
  nonce: isArc ? validated.nonce : pending.nonce.toString(),
};
localStorage.setItem("melodypay_last_receipt", JSON.stringify(receiptData));
navigate("/receipt", { state: receiptData });
```

Use the actual variables already available in each branch; do not introduce simulated hashes.

### Task 4: Verify, Commit, and Push

**Files:**
- Verify: `receiver-web/src/App.tsx`
- Verify: `receiver-web/src/pages/ReceivePayment.tsx`
- Verify: `receiver-web/src/pages/Register.tsx`
- Verify: `receiver-web/src/pages/PaymentReceipt.tsx`

**Interfaces:**
- Consumes: completed receiver, prebooking, and receipt routes.
- Produces: verified code pushed to `origin/main`.

- [ ] **Step 1: Confirm email and fake-transaction boundaries**

Run:

```bash
rg -n "BREVO|RESEND|sendinblue|resend\\.com|/api/send-email|VITE_RESEND_API_KEY|simulatedHash|keccak256\\(ethers\\.toUtf8Bytes" receiver-web/src
```

Expected: no matches.

- [ ] **Step 2: Run tests and build**

Run `npm test` and `npm run build`. Expected: 24 tests pass and the production build completes successfully.

- [ ] **Step 3: Review the final diff**

Run `git diff --check` and `git status --short --branch`. Do not stage `.env` or `contracts/lib/contracts-v2`.

- [ ] **Step 4: Commit and push**

Use:

```bash
git add receiver-web/src/App.tsx receiver-web/src/pages/ReceivePayment.tsx receiver-web/src/pages/Register.tsx receiver-web/src/pages/PaymentReceipt.tsx
git commit -m "feat: add receiver and receipt ui flows"
git push origin main
```

Verify `git ls-remote origin refs/heads/main` points to the new commit.
