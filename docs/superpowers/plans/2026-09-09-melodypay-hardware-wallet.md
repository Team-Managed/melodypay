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

- Create `esp32/`: ESP-IDF project, wallet state machine, display, buttons, I2S, ggwave, transaction signing.
- Create `esp32/components/protocol/`: versioned message encoding, decoding, chunking, checksum.
- Create `esp32/components/evm/`: transaction parsing, address display, signing interface.
- Create `cli/`: keyless online operator terminal.
- Modify `receiver-web/src/core/tx-builder.ts`: chain profiles and receiver-side typed transaction creation/validation.
- Modify `receiver-web/src/core/listener.ts` and `receiver-web/src/core/broadcaster.ts`: protocol compatibility during migration.
- Create `docs/hardware-shopping-list.md`: standalone BOM and alternatives.
- Create `docs/protocol.md`: wire format and compatibility rules.
- Create `docs/security-model.md`: threat model, prototype limitations, and production requirements.

### Task 1: Create Hardware Shopping Documentation

**Files:**
- Create: `docs/hardware-shopping-list.md`

- [ ] Record the selected prototype parts: ESP32-S3 DevKit N16R8, INMP441 I2S microphone, generic MAX98357A I2S amplifier, 0.5W 8-ohm speaker, 0.96-inch SSD1306 OLED, two tactile switches, solderless breadboard, Dupont wires, USB data cable, and 5V power source.
- [ ] Mark listed prices as user-provided India prices and label all unverified prices as retailer-dependent.
- [ ] Add alternatives and compatibility notes, especially that TPA3118/TDA/LM386/PAM8403 boards are not direct I2S replacements for MAX98357A.
- [ ] Note that the bench speaker is unsuitable for ultrasound, require Protocol 2 Audible Fastest for bench tests after a spectral check, and mandate short ($\le 10\text{ cm}$) Dupont wires for 3.072 MHz I2S clock lines with parallel ground shielding.
- [ ] Separate required prototype items from production-only items: secure element, custom PCB, enclosure, battery, charger, and secure boot provisioning.

### Task 2: Scaffold Firmware and Hardware Abstraction

**Files:**
- Create: `firmware/CMakeLists.txt`
- Create: `firmware/sdkconfig.defaults`
- Create: `firmware/main/main.c`
- Create: `esp32/main/hardware.h`
- Create: `esp32/main/hardware.c`

- [ ] Scaffold an ESP-IDF v5.2+ project targeting ESP32-S3 (`idf.py set-target esp32s3`).
- [ ] Define board pin configuration exclusively in `esp32/main/hardware.h` matching the pin matrix in `docs/hardware-shopping-list.md` (INMP441 on GPIO 4/5/6, MAX98357A on GPIO 15/16/7, SSD1306 on GPIO 8/9, Buttons on GPIO 17/18).
- [ ] Initialize SSD1306 via `esp_lcd` (or `u8g2`), two buttons with software debounce (active LOW, internal pull-up), I2S0 microphone input, and I2S1 speaker output using modern `driver/i2s_std.h`.
- [ ] Configure I2S0 for INMP441: Set slot format to `I2S_DATA_BIT_WIDTH_32BIT` (Left channel, `L/R` pin tied to GND). In the DMA loop, bit-shift the 24-bit data (`sample >> 14`) to produce clean 16-bit signed PCM without digital static.
- [ ] Route a ground line parallel to the 3.072 MHz `BCLK` and keep I2S Dupont wires $\le 10\text{ cm}$ to prevent clock ringing and bit-slips.
- [ ] Configure FreeRTOS Dual-Core Task Pinning:
  - **Core 0 (Audio & DSP Worker):** Dedicated task for I2S DMA streaming, RMS noise squelch gating, and ggwave FFT decode/encode.
  - **Core 1 (UI, State & Crypto Worker):** Dedicated task for SSD1306 OLED rendering, button debouncing, wallet state machine, and secp256k1 signing.
- [ ] Implement half-duplex audio control functions `hardware_mute_mic()` and `hardware_unmute_mic()` to prevent acoustic feedback during speaker output.
- [x] Add an assembled-hardware self-test that prints audio, button, and display status over USB serial without touching key material.
- [x] Build the firmware with `idf.py build`.

### Task 2a: ESP32-S3 Bring-up Checkpoint

**Files:**
- Verify: `esp32/build/melodypay_wallet.bin`
- Verify: `esp32/main/main.c`
- Verify: `esp32/main/hardware.c`

The initial USB-only checkpoint was completed on September 12, 2026 using the physical ESP32-S3 N16R8 board on `COM4` with ESP-IDF `v5.5.5`. The temporary bare-board diagnostic mode has now been removed.

- [x] Build the ESP32-S3 firmware with `idf.py build`.
- [x] Generate bootloader, partition table, and `melodypay_wallet.bin`.
- [x] Flash the image with `idf.py -p COM4 flash` and verify esptool hash checks.
- [x] Verify serial output reports ESP32-S3, 16 MB flash, 8 MB PSRAM, and a passing PSRAM memory test.
- [x] Verify the temporary USB-only diagnostic firmware booted successfully.
- [x] Verify NVS development-key initialization and wallet state `0`.
- [x] Build and flash the assembled-module firmware and verify I2S initialization without a diagnostic bypass.
- [x] Detect the SSD1306 at I2C address `0x3c` and send its test pattern.
- [x] Run the low-volume amplifier write test and receive microphone samples.
- [ ] Confirm the tone is audible and the OLED pattern is visible.
- [ ] Press the Approve and Reject buttons on GPIO17/GPIO18 and verify edge logs over serial.

The development key backend is not safe for real funds, and the secure signing boundary remains fail-closed until a reviewed secp256k1 or secure-element backend is integrated.

### Task 2b: Implement First-Boot Key Generation

**Files:**
- Modify: `firmware/main/main.c`
- Create: `firmware/main/keystore.h`
- Create: `firmware/main/keystore.c`

- [ ] On first boot, detect absence of stored key material in NVS (Non-Volatile Storage).
- [ ] Use `esp_fill_random()` only after confirming the ESP32-S3 hardware RNG entropy source is available in the selected offline configuration. ADC noise and timer jitter may be supplemental diagnostics, but must not be treated as the cryptographic entropy source. The product revision must use the secure element's validated RNG.
- [ ] Verify Curve Order Invariant: Validate that the candidate 32-byte private key strictly satisfies $0 < \text{privateKey} < n$ (secp256k1 curve order); discard and re-roll if invalid or zero.
- [ ] Store the key in an NVS partition (cleartext in bench dev; encrypted if flash encryption is enabled).
- [ ] Add `CONFIG_USE_HARDCODED_DEV_KEY` build flag: If set, loads a pre-funded testnet development key to prevent faucet fund loss across `idf.py erase-flash`.
- [ ] Derive the Ethereum public address via Keccak-256 and print to USB serial (`[KEYSTORE] Wallet Address: 0x...`) for easy faucet copying.
- [ ] Display the derived address on the OLED during first-boot setup.
- [ ] On subsequent boots, load the key from NVS silently and transition directly to `IDLE`.
- [ ] Clearly label this as a development key backend — no BIP-39 mnemonic or backup flow in MVP.
- [ ] Block production build configuration until secure-element signing is selected.

### Task 3: Implement Versioned Audio Protocol

**Files:**
- Create: `firmware/components/protocol/include/protocol.h`
- Create: `firmware/components/protocol/protocol.c`
- Create: `firmware/components/protocol/test_protocol.c`
- Read: `docs/protocol.md`

- [ ] Define message types `HELLO` (0x01), `PAYMENT_REQUEST` (0x02), `SIGNED_TRANSACTION` (0x03), `RECEIPT` (0x04), `REJECTED` (0x05), and `ERROR` (0x06).
- [ ] Implement the 8-byte chunk framing header: `MAGIC` (0x4D), `PROTO_VER` (0x01), `MSG_ID`, `CHUNK_INDEX`, `TOTAL_CHUNKS`, `PAYLOAD_LEN`, `CHUNK_CRC8` with max 128-byte payload.
- [ ] Implement dynamic chunk framing: split payment requests and signed EIP-1559 transaction payloads into the minimum number of chunks permitted by the 8-byte header and 128-byte payload limit, enforce a maximum message size, and insert a 300ms inter-burst silence gap.
- [ ] Implement post-transmission buffer wipe: After emitting both chunks, immediately `memset` the signed transaction buffer to zero and transition to listening for `RECEIPT` within the remaining TTL window. There is no resend mechanism — if the receiver misses chunks, recovery requires a fresh `PAYMENT_REQUEST` from the merchant terminal.
- [ ] Implement polynomial 0x07 CRC-8 calculation and validation.
- [ ] Reject invalid magic, version, length, sequence, total, checksum, and duplicate chunks.
- [ ] Add golden unit test vectors for native payment requests and signed transaction chunks that run on host (CMake/CTest).
- [ ] Document temporary text compatibility with `ADDR|`, `PAY|`, and `TX<n>/<total>|` for receiver bring-up.

### Task 4: Add ggwave Native Audio Transport

**Files:**
- Create: `firmware/components/ggwave/CMakeLists.txt`
- Create: `firmware/components/ggwave/ggwave_transport.c`
- Modify: `firmware/main/main.c`

- [ ] Vendor or add pinned native ggwave C++ source as an ESP-IDF component.
- [ ] Allocate large ggwave sample buffers in external PSRAM (`MALLOC_CAP_SPIRAM`) to preserve internal SRAM.
- [ ] Lock bench testing to Audible Fastest (Protocol 2) and verify the actual frequency range with a spectral recording; reserve ultrasonic profiles for a production transducer.
- [ ] Implement software squelch / noise gate: calculate RMS amplitude of input audio; discard buffers below calibrated threshold before calling ggwave FFT to preserve CPU.
- [ ] Feed INMP441 PCM samples into the pinned ggwave decoder at its supported sample rate, resampling the ESP32 I2S stream if necessary; use 16-bit mono after the documented 24-bit-to-16-bit conversion.
- [ ] Encode outgoing protocol frames to PCM and stream through MAX98357A I2S.
- [ ] Enforce half-duplex turn-taking: mute microphone DMA while speaker is active and discard echo window (800ms) after playback.
- [ ] Add receive timeout (driven by request `ttl_seconds`, default 60s), duplicate suppression, and bounded reassembly memory.
- [ ] Record audio fixtures from the receiver and verify decode on the ESP32-S3.

### Task 5: Implement Offline EVM Transaction Layer

**Files:**
- Create: `firmware/components/evm/include/evm_tx.h`
- Create: `firmware/components/evm/evm_tx.c`
- Create: `firmware/components/evm/test_evm_tx.c`

- [ ] Integrate `trezor-crypto` (or lightweight secp256k1 + Keccak-256) into `firmware/components/evm/`.
- [ ] Implement built-in Common Chain Registry table mapping `chainId` to `(networkName, nativeSymbol, maxNormalFeeWei)` (covering Monad `10143`, Sepolia `11155111`, Ethereum Mainnet `1`, Base `8453`, Arbitrum `42161`, Polygon `137`). Enforce strict whitelist: immediately reject any unmapped `chainId` with `❌ UNSUPPORTED CHAIN` and never sign.
- [ ] Parse native EIP-1559 fields without an RPC call using 256-bit big-integer arithmetic (`bignum256` or 32-byte buffers) for `value`, `maxFeePerGas`, and `maxPriorityFeePerGas` to prevent integer overflow crashes on values $\ge 18.44$ tokens.
- [ ] Enforce Gas Limit Invariant: For native transfers, verify `gasLimit <= 30000` (exactly 21,000 on Monad/Ethereum); reject bloated limits to protect against Monad's charge-on-gas-limit rule.
- [ ] Enforce Nonce Monotonicity: Cache `last_signed_nonce[chainId]` in memory; trigger `⚠️ STALE NONCE` warning if incoming request `nonce <= last_signed_nonce[chainId]`.
- [ ] Implement minimal C RLP serializer for type 2 EIP-1559 transactions: `0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, [v, r, s]])`.
- [ ] Implement EIP-55 mixed-case checksum formatting for recipient address verification on OLED, displaying the complete 42-character address across 2 lines on a single review screen so the full address is visible at once.
- [ ] Enforce Chain-Aware Fee Sanity Ceiling: If calculated max fee exceeds the chain's maximum normal fee threshold from the registry (or >5% of transfer value), trigger a high-fee warning state.
- [ ] Implement wei-to-token decimal conversion for OLED display using the resolved native symbol from the chain registry.
- [ ] Provide a signing interface that computes Keccak-256 digest and RFC 6979 deterministic ECDSA signature with recovery parity `yParity` (0 or 1); encode it as the EIP-1559 transaction's parity field rather than legacy `v` semantics.
- [ ] Initially use a clearly labelled development key backend only for bench tests; block production build configuration until secure-element signing is selected.
- [ ] Add test vectors generated from ethers.js for Monad Testnet and Ethereum Sepolia native transfers.

### Task 6: Add Wallet State, Display, and Physical Approval

**Files:**
- Create: `firmware/main/wallet_state.h`
- Create: `firmware/main/wallet_state.c`
- Create: `firmware/main/display.c`
- Modify: `firmware/main/main.c`

- [ ] Implement states `IDLE`, `RECEIVING`, `REVIEW`, `APPROVED`, `TRANSMITTING`, and `ERROR`.
- [ ] Implement post-transmission flow: After `TRANSMITTING`, display `"Tx Sent"`, listen for `RECEIPT` within TTL, display result (success or timeout), wipe all buffers, and return to `IDLE`.
- [ ] Implement 2-button UI state machine on SSD1306:
  - **Short-press Approve:** Paginates review screens (Page 1: Network & Amount, Page 2: Full Recipient Address in EIP-55 format on single screen, Page 3: Gas Fee, High-Fee warning if applicable, and Hold-to-Sign prompt).
  - **Long-press Approve (Hold ≥ 2s):** Confirms transaction, executes signature, and moves to `TRANSMITTING`.
  - **Short-press Reject:** Cancels transaction, wipes pending buffers, and returns to `IDLE`.
- [ ] Display verified network name/chain ID, asset, amount, full recipient address, and fee before approval.
- [ ] Ensure no signature is generated in `RECEIVING` or `REVIEW`.
- [ ] Add a power-loss-safe pending-request reset; never persist unsigned request data as wallet state.

### Task 7: Refactor Receiver to Be Keyless and Multi-chain

**Files:**
- Modify: `receiver-web/src/pages/ReceivePayment.tsx`
- Modify: `receiver-web/src/core/tx-builder.ts`
- Modify: `receiver-web/src/core/listener.ts`
- Modify: `receiver-web/src/core/broadcaster.ts`
- Create: `receiver-web/src/core/chains.ts`
- Create: `receiver-web/src/core/payment-protocol.ts`

- [ ] Dynamically match browser sample rate: Pass `audioCtx.sampleRate` directly into ggwave initialization instead of hardcoding 48kHz, ensuring full compatibility with 44.1kHz Windows/Android devices.
- [ ] Bypass browser WebRTC filters: Explicitly set `echoCancellation: false`, `noiseSuppression: false`, and `autoGainControl: false` in `navigator.mediaDevices.getUserMedia` so the browser does not filter modem chirps.
- [ ] Remove receiver private-key onboarding and all `localStorage` private-key reads from the receiver flow.
- [ ] Keep receiver address, selected chain, amount, nonce, and fee configuration only.
- [ ] Add chain profiles for Monad Testnet and Ethereum Sepolia first, with an extensible EVM profile shape.
- [ ] Send chain ID, request ID, TTL duration seconds, and fee data in the payment request envelope.
- [ ] Update receiver UI to display an `Audio Failed — Tap to Retry Payment` prompt if chunks fail CRC-8 or the session times out, which triggers a fresh `PAYMENT_REQUEST` with a new nonce.
- [ ] Implement receiver-side session timeout: If no valid `SIGNED_TRANSACTION` is received within `ttl_seconds`, cancel the pending session and prompt the merchant to retry.
- [ ] Implement broadcast error handling: If the RPC returns an error (insufficient funds, nonce conflict, gas estimation failure), display the specific error to the merchant instead of a generic failure.
- [ ] Implement `(requestId, txHash)` deduplication: If the receiver somehow receives the same signed transaction twice (e.g., acoustic echo), suppress the duplicate broadcast.
- [ ] Validate recovered sender, chain ID, recipient, value, token/calldata policy, request ID, and expiry before broadcast.
- [ ] Preserve receiver-driven order: listen for wallet `HELLO`, fetch network data, request payment, listen for signed response, broadcast, return receipt.
- [ ] Keep text protocol compatibility until the firmware binary protocol passes physical tests.

### Task 8: Add ERC-20 Transfer Support

**Files:**
- Modify: `esp32/components/evm/evm_tx.c`
- Modify: `receiver-web/src/core/payment-protocol.ts`
- Modify: `receiver-web/src/core/tx-builder.ts`
- Create: `receiver-web/src/core/tokens.ts`

- [ ] Support only the exact ERC-20 `transfer(address,uint256)` selector (`0xa9059cbb`).
- [ ] Maintain a firmware token contract whitelist `(chainId, contractAddress, symbol, decimals)` to prevent rogue contract calls.
- [ ] Configure token address, symbol, decimals, and chain ID in the receiver profile.
- [ ] Display token contract identity and formatted amount on the hardware OLED.
- [ ] Reject approvals, permit methods, swaps, arbitrary calldata, and unknown token contracts.
- [ ] Test malformed calldata and decimal conversion boundaries.

### Task 9: Security Hardening and Production Boundary

**Files:**
- Create: `docs/security-model.md`
- Create: `esp32/SECURE_BUILD.md`
- Modify: `esp32/sdkconfig.defaults`

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
