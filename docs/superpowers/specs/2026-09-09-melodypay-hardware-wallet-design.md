# MelodyPay Hardware Wallet Design

## Goal

Replace the browser proof of concept with a minimal, sellable-oriented hardware wallet that signs EVM payments offline and communicates with the online receiver over ggwave audio.

## Existing Proof of Concept

The current PWA proves the following flow:

1. The receiver listens for `ADDR|<sender>`, fetches the sender nonce, and sends `PAY|<receiver>|<amount>|<nonce>`.
2. The sender signs locally and sends the signed transaction in `TX<n>/<total>|<payload>` chunks.
3. The receiver reassembles, checks recipient and amount, broadcasts to Monad, and displays the transaction hash.

The following existing code is protocol reference only and will not be used as wallet firmware:

- `src/pages/SendPayment.tsx`
- `src/pages/ReceivePayment.tsx`
- `src/core/ggwave.ts`
- `src/core/listener.ts`
- `src/core/broadcaster.ts`
- `src/core/tx-builder.ts`

The browser key flow is not acceptable for the hardware product: `Onboarding.tsx` stores a raw private key in `localStorage`, and `SendPayment.tsx` signs automatically without physical confirmation.

## Architecture

```text
Online receiver
  - chooses chain, asset, amount, and receiving address
  - fetches nonce and fee data
  - plays a payment request over speaker
  - listens for signed response
  - validates and broadcasts through RPC
  - plays receipt/status over speaker

Offline hardware wallet
  - generates and stores the wallet key
  - listens through INMP441
  - validates request format and chain policy
  - displays chain, recipient, amount, and fee
  - waits for physical Approve or Reject
  - signs locally
  - transmits signed transaction through MAX98357A and speaker
```

There is no separate relay. The receiver is the online participant and broadcaster. The hardware wallet never needs RPC, Wi-Fi, Bluetooth, or a private-key import screen.

## Scope

### Hackathon MVP

- ESP32-S3 firmware using ESP-IDF.
- Native EVM transfers with EIP-1559 transaction signing.
- Standard ERC-20 `transfer(address,uint256)` support only after native transfers are stable.
- Chain ID included in every request and signed transaction.
- Strict chain whitelist with unknown chains rejected immediately.
- ggwave C/C++ integration through I2S input/output.
- SSD1306 128x64 OLED.
- Approve and Reject tactile buttons.
- Receiver-side validation and broadcast without any private key.
- Testnet demo on Monad and Ethereum Sepolia, with the protocol designed for any EVM chain.

### Explicitly excluded

- EIP-3009.
- Arbitrary calldata, swaps, approvals, permit signatures, bridges, and smart-account operations.
- Wi-Fi, Bluetooth, battery, touch screen, camera, NFC, SD card, and cloud backend.
- Mainnet security claims before secure-element integration and independent review.

## Security Boundary

The ESP32-S3 prototype may use encrypted flash and secure boot for development, but a product wallet must use a secure element that explicitly supports Ethereum `secp256k1` signing. The secure element is a required production milestone, not an optional security upgrade.

Every signing request must be independently checked on the device. The display must show the verified network name, chain ID, asset, amount, full recipient in EIP-55 mixed-case checksum format (displayed across 2 lines on a single review screen), fee, and request ID. Unrecognized or unmapped chains are strictly rejected by the device.

### Device Verification Invariants:
1. **Relative TTL Countdown:** The device enforces a relative countdown (default 60 seconds) using its internal hardware timer (`esp_timer_get_time()`). If approval is not confirmed within the TTL, the pending request is wiped.
2. **256-bit Big-Integer Arithmetic:** All EVM amounts, fees, and RLP encodings use 256-bit integer structures (`bignum256` or 32-byte buffers) to prevent integer overflow crashes on values $\ge 18.44$ tokens.
3. **Gas Limit Ceiling:** For native transfers, `gasLimit` is verified to be $\le 30,000$ (exactly 21,000 on Monad/Ethereum). Requests with bloated gas limits are rejected to protect against Monad's charge-on-gas-limit rule.
4. **Nonce Monotonicity:** The device caches `last_signed_nonce[chainId]` in memory to flag duplicate or stale nonces (`⚠️ STALE NONCE`).
5. **Strict Chain Whitelist & Fee Sanity Ceiling:** The device strictly verifies `chainId` against its internal firmware whitelist. Any request with an unmapped `chainId` is rejected immediately with an error (`❌ UNSUPPORTED CHAIN`) and will never be signed. If estimated gas fee exceeds the whitelisted chain's maximum normal fee threshold (or >5% of the transaction value), a high-fee warning state is triggered.
6. **Physical Confirmation:** Signing only occurs after the Approve button is pressed (with a 2-second hold confirmation on final page). Reject cancels and returns no signature.
7. **Key Validity Invariant:** Generated private keys must strictly satisfy secp256k1 curve order constraints ($0 < \text{privateKey} < n$). Development firmware may collect supplemental ADC noise and timer jitter, but cryptographic entropy must come from a validated hardware RNG or, for the product revision, the secure element's RNG. Development builds provide a hardcoded test key flag to avoid faucet fund loss during flashing.

## Protocol

The current text messages are retained during bring-up because they are easy to inspect. Before productization, use a versioned binary envelope with length, message type, request ID, chain ID, asset type, recipient, amount, nonce, full-width fee fields, TTL seconds, and checksum. Signed transactions and payment requests use dynamic chunk counts bounded by the implementation's maximum message size, with a 300ms inter-chunk interval. After transmission, the signed buffer is immediately wiped from memory and the device listens for a `RECEIPT` within the TTL window. If audio fails, recovery requires the merchant to initiate a fresh `PAYMENT_REQUEST` from the terminal; there is no resend mechanism.

Minimum message types:

- `HELLO`: hardware wallet address and protocol version.
- `PAYMENT_REQUEST`: receiver address, audio profile (audible/ultrasound), chain ID, native/ERC-20 asset, amount, nonce, fee, TTL seconds, request ID.
- `SIGNED_TRANSACTION`: signed EVM transaction (transmitted across dynamically sized chunks).
- `RECEIPT`: transaction hash, status, and request ID.
- `REJECTED` and `ERROR`: bounded error code and request ID.

The receiver must reject malformed messages, mismatched request IDs, expired requests, wrong chain IDs, wrong recipient, wrong token contract, wrong amount, duplicate signed payloads, and transactions whose recovered sender does not match the announced wallet address.

## Multi-chain Strategy

The signer is network-independent at the cryptographic layer: it signs standard EVM transaction fields and never connects to any network. The device still applies a firmware chain policy so it can display a verified network name and fee policy. The receiver terminal owns the RPC, gas estimation, and explorer configuration.

### Built-in Firmware Chain Registry
The hardware wallet maintains a static whitelist lookup table of approved EVM chains for safe display and fee validation:

| Chain ID | Network Display Name | Native Asset Symbol | Max Normal Fee Ceiling | Action on Request |
|---|---|---|---|---|
| `10143` | Monad Testnet | `MON` | 0.01 MON | Allowed |
| `11155111` | Ethereum Sepolia | `ETH` | 0.005 ETH | Allowed |
| `1` | Ethereum Mainnet | `ETH` | 0.01 ETH | Allowed |
| `8453` | Base | `ETH` | 0.001 ETH | Allowed |
| `42161` | Arbitrum One | `ETH` | 0.001 ETH | Allowed |
| `137` | Polygon | `POL` | 0.1 POL | Allowed |
| `*` (Any other) | Unmapped / Unknown | N/A | N/A | **Strictly Rejected (`❌ UNSUPPORTED CHAIN`)** |

Native transfers are supported exclusively across whitelisted EVM chains. Any unmapped or unrecognized chain ID is rejected immediately by the firmware to prevent blind-signing, cross-chain spoofing, and gas drain vulnerabilities. ERC-20 support is limited to decoding and signing `transfer(address,uint256)` on approved, whitelisted token contracts matching the requested chain ID.

## Validation and Testing

- Unit-test binary/text encoding, chunking, checksums, transaction parsing, chain ID enforcement, ERC-20 calldata decoding, and receiver validation.
- Firmware-test ggwave encode/decode using recorded audio fixtures and physical speaker/microphone tests.
- Test rejected recipient, amount, chain, expiry, and calldata cases.
- Test that the wallet never emits a private key and never signs before approval.
- Test receiver broadcast against Monad Testnet and Ethereum Sepolia.
- Run static analysis and build firmware with secure boot and flash encryption documented as deployment requirements.

## Sponsor Fit

No sponsor integration should expand the wallet's signing attack surface. The strongest product-aligned integrations are optional receiver-side chain profiles and payment discovery. The MVP should first prove secure, universal EVM signing; sponsor integrations can be added only if they fit the same validated payment request format.
