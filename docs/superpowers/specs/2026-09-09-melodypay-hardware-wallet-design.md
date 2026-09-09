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
- Common-chain registry plus generic EVM mode with an explicit warning.
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

Every signing request must be independently checked on the device. The display must show the network name or `Unknown EVM`, chain ID, asset, amount, recipient in pages, fee, and expiration/request ID. Signing only occurs after the Approve button is pressed. Reject cancels and returns no signature.

## Protocol

The current text messages are retained during bring-up because they are easy to inspect. Before productization, use a versioned binary envelope with length, message type, request ID, chain ID, asset type, recipient, amount, nonce, fee fields, expiry, and checksum. All messages are chunked with sequence number and total count.

Minimum message types:

- `HELLO`: hardware wallet address and protocol version.
- `PAYMENT_REQUEST`: receiver address, chain ID, native/ERC-20 asset, amount, nonce, fee, expiry, request ID.
- `SIGNED_TRANSACTION`: signed EVM transaction chunks.
- `RECEIPT`: transaction hash, status, and request ID.
- `REJECTED` and `ERROR`: bounded error code and request ID.

The receiver must reject malformed messages, mismatched request IDs, expired requests, wrong chain IDs, wrong recipient, wrong token contract, wrong amount, duplicate signed payloads, and transactions whose recovered sender does not match the announced wallet address.

## Multi-chain Strategy

The signer is chain-agnostic. It signs EVM transaction fields and does not contact a chain. The receiver owns the RPC and explorer configuration. A chain profile contains chain ID, display name, RPC URL, explorer URL, native symbol, fee policy, and supported token metadata.

Native transfers are universal. Generic EVM mode displays an explicit unknown-network warning and requires confirmation. ERC-20 support is limited to decoding and signing `transfer(address,uint256)` and only configured token contracts.

## Validation and Testing

- Unit-test binary/text encoding, chunking, checksums, transaction parsing, chain ID enforcement, ERC-20 calldata decoding, and receiver validation.
- Firmware-test ggwave encode/decode using recorded audio fixtures and physical speaker/microphone tests.
- Test rejected recipient, amount, chain, expiry, and calldata cases.
- Test that the wallet never emits a private key and never signs before approval.
- Test receiver broadcast against Monad Testnet and Ethereum Sepolia.
- Run static analysis and build firmware with secure boot and flash encryption documented as deployment requirements.

## Sponsor Fit

No sponsor integration should expand the wallet's signing attack surface. The strongest product-aligned integrations are optional receiver-side chain profiles and payment discovery. The MVP should first prove secure, universal EVM signing; sponsor integrations can be added only if they fit the same validated payment request format.
