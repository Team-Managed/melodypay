# Receiver and Receipt UI Design

## Goal

Bring `/receive` and the missing `/receipt` flow in line with the approved `feat/ui-ux` visual language while preserving the current multi-chain, ENS, Arc, and hardware-audio payment behavior.

## Recommended Approach

Port the branch's visual composition selectively rather than copying its page logic. The current receiver state machine remains authoritative; the branch contributes the editorial hero, glassmorphic payment terminal, phase/status treatment, telemetry/specification panel, and thermal receipt animation. A new shared receipt data shape will carry payment and prebooking results into `/receipt`.

The branch's Base-only defaults, alternate audio helpers, simulated receipt behavior, and email implementation are explicitly excluded.

## Receiver Design

- Full-bleed meadow background with dark forest vignette and fixed-header-safe viewport shell.
- Editorial page header:
  - `// AIR-GAPPED ACOUSTIC POS TERMINAL`
  - `Receive Sound Payments.`
  - `Air-gapped acoustic wire. Settled on-chain.`
- Left glass terminal card:
  - Wallet/status strip without replacing the existing recipient controls.
  - ENS/address input, current chain selector, amount input, and optional quick amount presets.
  - Resolved ENS feedback, validation errors, start/cancel controls, and state-specific payment progress.
  - Confirmed state with recipient, amount, hash copy, explorer link, and receipt action.
- Right glass telemetry card:
  - Acoustic telemetry heading and live status indicator.
  - Animated sound visualization using existing visual components only.
  - Air-gapped payment architecture and hardware-protocol facts.
- Desktop uses two columns; mobile collapses to one column with natural scrolling.

## Receipt Design

Add a `/receipt` route backed by a typed `ReceiptData` model supporting:

- `pos_payment` for native and Arc payments.
- `prebooking` for Base hardware reservations.
- Existing ENS receipt fields where present.

The page uses the branch's thermal-printer presentation:

- Meadow or acoustic background and dark overlay.
- Printer chassis with status LEDs, feed control, cutter bar, and animated receipt paper feed.
- Receipt paper containing settlement type, amount/token, network, timestamp, payer, recipient, queue or subname metadata, and transaction hash.
- Copy-hash action and chain-specific explorer link.
- Feed/replay animation control.
- Refresh fallback through `localStorage` without inventing receipt data.

## Data Flow

- `ReceivePayment` creates receipt data from the actual resolved recipient, chain configuration, payer/authorizer, amount, tx hash, nonce, and timestamp.
- Native and Arc settlement results navigate to `/receipt` after the existing receipt audio/status handling completes.
- `Register` creates prebooking receipt data from the actual Base transaction, quantity, contract recipient, and timestamp, with no email dispatch.
- `PaymentReceipt` derives the explorer URL from `getChainConfig(receipt.chainId)` and uses explicit fallbacks only for known Base/Sepolia cases.
- Receipt state is stored under `melodypay_last_receipt` for refresh recovery.

## Non-Goals

- Do not replace the current receiver handlers with the branch's Base-only implementation.
- Do not change Arc EIP-3009 validation or ENS resolution.
- Do not add Brevo, Resend, `/api/send-email`, or client email keys.
- Do not add simulated transaction hashes or fake settlement success paths.

## Verification

- Existing protocol, Arc, ENS, and hardware tests remain green.
- TypeScript and production build pass.
- Client source contains no email API calls or email secrets.
- `/receive`, `/register`, and `/receipt` routes compile and render through the same app shell.
