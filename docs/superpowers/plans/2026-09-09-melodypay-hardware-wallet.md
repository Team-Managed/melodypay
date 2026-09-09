# MelodyPay Hardware Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal ESP32-S3 hardware wallet that signs EVM payments offline and completes the existing receiver-driven ggwave payment flow.

**Architecture:** The receiver remains online and requests the amount, chain, nonce, and fee data. The hardware wallet owns the key, displays the request, requires physical approval, signs locally, and sends the signed transaction back by audio. The receiver validates and broadcasts it without holding a sender key.

**Tech Stack:** ESP-IDF, C/C++, ESP32-S3, ggwave native library, I2S, SSD1306, secp256k1-compatible signing, existing TypeScript receiver during migration.

## Global Constraints

- Do not persist or import raw private keys in the receiver.
- Do not implement EIP-3009 in the MVP.
- Support native EVM transfers first; ERC-20 `transfer` is a second milestone.
- Require physical approval before every signature.
- Include chain ID in every payment request and signed transaction.
- Keep the receiver as the online participant; do not create a separate relay.
- Do not claim production security until secure-element integration is complete.

## File Map

- Create `firmware/`: ESP-IDF project, wallet state machine, display, buttons, I2S, ggwave, transaction signing.
- Create `firmware/components/protocol/`: versioned message encoding, decoding, chunking, checksum.
- Create `firmware/components/evm/`: transaction parsing, address display, signing interface.
- Create `receiver/`: keyless receiver implementation extracted from current PWA logic.
- Modify `src/core/tx-builder.ts`: chain profiles and receiver-side typed transaction creation/validation.
- Modify `src/core/listener.ts` and `src/core/broadcaster.ts`: protocol compatibility during migration.
- Create `docs/hardware-shopping-list.md`: standalone BOM and alternatives.
- Create `docs/protocol.md`: wire format and compatibility rules.
- Create `docs/security-model.md`: threat model, prototype limitations, and production requirements.

### Task 1: Create Hardware Shopping Documentation

**Files:**
- Create: `docs/hardware-shopping-list.md`

- [ ] Record the selected prototype parts: ESP32-S3 DevKit N16R8, INMP441 I2S microphone, generic MAX98357A I2S amplifier, 0.5W 8-ohm speaker, 0.96-inch SSD1306 OLED, two tactile switches, solderless breadboard, Dupont wires, USB data cable, and 5V power source.
- [ ] Mark listed prices as user-provided India prices and label all unverified prices as retailer-dependent.
- [ ] Add alternatives and compatibility notes, especially that TPA3118/TDA/LM386/PAM8403 boards are not direct I2S replacements for MAX98357A.
- [ ] Separate required prototype items from production-only items: secure element, custom PCB, enclosure, battery, charger, and secure boot provisioning.

### Task 2: Scaffold Firmware and Hardware Abstraction

**Files:**
- Create: `firmware/CMakeLists.txt`
- Create: `firmware/sdkconfig.defaults`
- Create: `firmware/main/main.c`
- Create: `firmware/main/hardware.h`
- Create: `firmware/main/hardware.c`

- [ ] Scaffold an ESP-IDF project targeting ESP32-S3.
- [ ] Define board pin configuration in one header; do not scatter GPIO numbers through protocol code.
- [ ] Initialize I2C OLED, two buttons with debounce, I2S microphone input, and I2S speaker output.
- [ ] Add a diagnostic mode that prints audio, button, and display status over USB serial without touching key material.
- [ ] Build the empty firmware with `idf.py build`.

### Task 3: Implement Versioned Audio Protocol

**Files:**
- Create: `firmware/components/protocol/include/protocol.h`
- Create: `firmware/components/protocol/protocol.c`
- Create: `firmware/components/protocol/test_protocol.c`
- Create: `docs/protocol.md`

- [ ] Define message types `HELLO`, `PAYMENT_REQUEST`, `SIGNED_TRANSACTION`, `RECEIPT`, `REJECTED`, and `ERROR`.
- [ ] Define a bounded binary envelope with version, type, request ID, payload length, payload, and checksum.
- [ ] Define chunk headers with message ID, sequence, total, and checksum.
- [ ] Reject invalid version, length, sequence, total, checksum, and duplicate chunks.
- [ ] Add golden test vectors for a native payment request and signed transaction chunk.
- [ ] Document temporary text compatibility with `ADDR|`, `PAY|`, and `TX<n>/<total>|` for receiver bring-up.

### Task 4: Add ggwave Native Audio Transport

**Files:**
- Create: `firmware/components/ggwave/CMakeLists.txt`
- Create: `firmware/components/ggwave/ggwave_transport.c`
- Modify: `firmware/main/main.c`

- [ ] Vendor or add the pinned native ggwave source as a firmware component.
- [ ] Feed INMP441 PCM samples into ggwave using the configured sample rate.
- [ ] Encode outgoing protocol frames to PCM and send them through MAX98357A I2S.
- [ ] Add receive timeout, duplicate suppression, and bounded reassembly memory.
- [ ] Record audio fixtures from the receiver and verify decode on the ESP32-S3.

### Task 5: Implement Offline EVM Transaction Layer

**Files:**
- Create: `firmware/components/evm/include/evm_tx.h`
- Create: `firmware/components/evm/evm_tx.c`
- Create: `firmware/components/evm/test_evm_tx.c`

- [ ] Parse native EIP-1559 fields without an RPC call.
- [ ] Validate chain ID, recipient, nonce, value, gas limit, max fee, priority fee, and transaction type.
- [ ] Implement address and amount formatting for the OLED.
- [ ] Provide a signing interface that accepts a digest and returns a signature without exposing key bytes to the caller.
- [ ] Initially use a clearly labelled development key backend only for bench tests; block production build configuration until secure-element signing is selected.
- [ ] Add test vectors generated from ethers.js for Monad Testnet and Ethereum Sepolia native transfers.

### Task 6: Add Wallet State, Display, and Physical Approval

**Files:**
- Create: `firmware/main/wallet_state.h`
- Create: `firmware/main/wallet_state.c`
- Create: `firmware/main/display.c`
- Modify: `firmware/main/main.c`

- [ ] Implement states `IDLE`, `RECEIVING`, `REVIEW`, `APPROVED`, `REJECTED`, `TRANSMITTING`, and `ERROR`.
- [ ] Display network name/chain ID, asset, amount, recipient pages, and fee before approval.
- [ ] Require a deliberate Approve button press; Reject and timeout must erase the pending request.
- [ ] Ensure no signature is generated in `RECEIVING` or `REVIEW`.
- [ ] Add a power-loss-safe pending-request reset; never persist unsigned request data as wallet state.

### Task 7: Refactor Receiver to Be Keyless and Multi-chain

**Files:**
- Modify: `src/pages/ReceivePayment.tsx`
- Modify: `src/core/tx-builder.ts`
- Modify: `src/core/listener.ts`
- Modify: `src/core/broadcaster.ts`
- Create: `src/core/chains.ts`
- Create: `src/core/payment-protocol.ts`

- [ ] Remove receiver private-key onboarding and all `localStorage` private-key reads from the receiver flow.
- [ ] Keep receiver address, selected chain, amount, nonce, and fee configuration only.
- [ ] Add chain profiles for Monad Testnet and Ethereum Sepolia first, with an extensible EVM profile shape.
- [ ] Send chain ID, request ID, expiry, and fee data in the payment request.
- [ ] Validate recovered sender, chain ID, recipient, value, token/calldata policy, request ID, and expiry before broadcast.
- [ ] Preserve current receiver-driven order: listen for wallet address, fetch network data, request payment, listen for signed response, broadcast, return receipt.
- [ ] Keep text protocol compatibility until the firmware binary protocol passes physical tests.

### Task 8: Add ERC-20 Transfer Support

**Files:**
- Modify: `firmware/components/evm/evm_tx.c`
- Modify: `src/core/payment-protocol.ts`
- Modify: `src/core/tx-builder.ts`
- Create: `src/core/tokens.ts`

- [ ] Support only the exact ERC-20 `transfer(address,uint256)` selector.
- [ ] Configure token address, symbol, decimals, and chain ID in the receiver profile.
- [ ] Display token contract identity and formatted amount on the hardware.
- [ ] Reject approvals, permit methods, swaps, arbitrary calldata, and unknown token contracts.
- [ ] Test malformed calldata and decimal conversion boundaries.

### Task 9: Security Hardening and Production Boundary

**Files:**
- Create: `docs/security-model.md`
- Create: `firmware/SECURE_BUILD.md`
- Modify: `firmware/sdkconfig.defaults`

- [ ] Document threats: malicious receiver, modified audio, replay, wrong-chain request, display truncation, firmware replacement, and physical extraction.
- [ ] Enable secure boot and flash encryption in a development-safe documented mode.
- [ ] Specify secure-element requirements: secp256k1 key generation, signing, non-exportability, provisioning, and recovery behavior.
- [ ] Mark development firmware as unsafe for real funds and prohibit mainnet claims in UI/docs.
- [ ] Add fuzz/property tests for protocol parsing and transaction validation.

### Task 10: Physical Demo and Evidence

**Files:**
- Modify: `README.md`
- Create: `docs/demo-script.md`
- Create: `docs/architecture.svg` or `docs/architecture.md`

- [ ] Document assembly, pin wiring, firmware flash, receiver setup, and two-device audio positioning.
- [ ] Demonstrate receiver requests 0.01 native token on Monad Testnet.
- [ ] Demonstrate hardware displays request, rejects one request, approves another, signs offline, and sends chunks by sound.
- [ ] Demonstrate receiver validates and broadcasts the transaction and returns a receipt.
- [ ] Repeat on Ethereum Sepolia to prove chain ID separation.
- [ ] Record limitations and pre-existing PWA work for Continuity-track submission evidence.
