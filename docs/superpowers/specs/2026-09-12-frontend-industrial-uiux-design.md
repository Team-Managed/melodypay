# MelodyPay Frontend Revamp: Industrial Studio UI/UX Design

> **Status:** Approved Design Specification  
> **Date:** 2026-09-12  
> **Target Theme:** Light Mode — Industrial Studio & Hardware Engineering  
> **Target Audience:** Hackathon Judges, Web3 Merchants, Hardware Engineers, POS Operators  

---

## 1. Executive Summary & Product Architecture

MelodyPay transforms ambient sound into an air-gapped financial transport layer. The architecture maintains a strict, verified security boundary:

1. **Payer / Hardware Signer (Offline & Air-Gapped)**:
   - **ESP32-S3 Physical Sound Wallet**: Powered by an INMP441 I2S microphone, MAX98357A I2S Class D amplifier with speaker, 0.96" cyan OLED display, and physical tactile pushbuttons (`GPIO 21 Approve`, `GPIO 22 Reject`). Zero WiFi, zero Bluetooth, zero cellular—completely air-gapped.
   - **Ledger Companion Signer**: Clear-signing hardware device alternative via Ledger Device Management Kit.
2. **Merchant Receiver Terminal (Online, Keyless & Untrusted)**:
   - Web application running on phones, tablets, or desktop browsers.
   - Strictly keyless: never holds or prompts for private keys.
   - Generates acoustic payment requests, listens for signed audio authorizations over ggwave, and broadcasts transactions directly to EVM RPC nodes.
3. **Smart Contract Infrastructure**:
   - **Arc Network Canonical USDC (`MelodyPaySettlement.sol`)**:
     - Chain ID: `5042002`, Native USDC precompile: `0x3600000000000000000000000000000000000000`.
     - Canonical EIP-3009 (`receiveWithAuthorization` & `transferWithAuthorization`).
     - Gasless for payer: customer pays $0 gas; merchant receiver submits and covers gas.
     - Dual replay protection, order ID tracking, and `SoundPaymentSettled` receipt events.
   - **Ethereum Sepolia ENSv2 Subnames (`MelodyPaySubnameRegistrar.sol`)**:
     - Issues emancipated wrapped subnames under `melodypay.eth` (e.g., `cafe.melodypay.eth`).
     - Records merchant forward resolution address and Arc USDC payment profiles.
   - **Monad Testnet Native Transfers**:
     - Chain ID: `10143`. Ultra-fast 10,000 TPS settlement via acoustic EIP-1559 transactions.

---

## 2. Design System: Industrial Studio & Hardware Engineering (Light Mode)

### 2.1 Aesthetic Philosophy
The visual language reflects physical electronics, precision test benches, and drafting studios. Instead of generic dark crypto cards or stark sterile white, the interface adopts warm drafting surfaces, technical micro-grid lines, tactile physical toggles, and live acoustic telemetry readouts.

### 2.2 Color Tokens
* **Backdrop**:
  - `canvas-base`: `#FBFBF9` (Warm technical drafting paper)
  - `canvas-subtle`: `#F5F5F0` (Secondary panel background)
  - `canvas-surface`: `#FFFFFF` (Pure white card surfaces)
* **Borders & Grid**:
  - `border-rule`: `#E2E2DA` (1px architectural drafting line)
  - `border-subtle`: `#ECECE6` (Secondary divider)
  - `grid-dot`: `rgba(0, 0, 0, 0.06)` (24px precision dot grid)
* **Typography & Contrast**:
  - `ink-primary`: `#111113` (Crisp carbon black for headers and primary text)
  - `ink-secondary`: `#4B4B52` (Engineering slate for descriptions)
  - `ink-muted`: `#7A7A85` (Technical metadata, units, and timestamps)
* **Telemetry Accents**:
  - `arc-cyan`: `#0088FF` / `#00E5FF` (Arc Network, USDC, primary soundwave crest)
  - `monad-purple`: `#836EF9` (Monad Testnet highlights)
  - `status-amber`: `#F59E0B` (Audio listening, transmitting, waiting states)
  - `status-emerald`: `#10B981` (Verified EIP-712 digests, settled transactions)
  - `status-rose`: `#EF4444` (Audio timeout, checksum error, reject button)

### 2.3 Typography Stack
* **Headings & Brand**: `Inter` / `Space Grotesk` with tight tracking (`tracking-tight font-semibold`).
* **Technical Readouts & Data**: `JetBrains Mono` / `SF Mono` / `font-mono` for EVM addresses, ENS nodes, FSK audio frequencies (`1875 Hz`), and hex signatures.
* **Component Labels**: Monospace uppercase micro-type (`text-[10px] tracking-widest uppercase font-mono`) with engineering annotations like `[SYS.01]`, `// TELEMETRY`, `[INMP441-MIC]`.

### 2.4 Tactile Components & Affordances
* Precision 1px bordered containers with corner tick marks (`+` delimiters).
* Status LEDs with subtle ambient glows (`w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]`).
* Tactile toggle buttons resembling mechanical switches.
* Real-time Canvas oscilloscope and FFT spectrum bars reacting to WebAudio.

---

## 3. Navigation & Studio Header

* **Brand**: Interactive acoustic equalizer logo (`MelodyPay`) + live system status badge (`[ONLINE // KEYLESS RECEIVER]`).
* **Route Navigation**:
  - `Overview` (`/`): Product architecture, live oscilloscope, hardware teardown, multi-chain matrix.
  - `Pre-book & Register` (`/register`): ENS subname availability, settlement configuration, reservation ticket.
  - `Receiver Terminal` (`/receive`): Keyless POS register, audio turn-taking state machine, on-chain receipt.
* **Network Telemetry Widget**:
  - Real-time indicator for Arc Testnet (`5042002`), Monad (`10143`), and Sepolia (`11155111`).
  - Audio Engine indicator: Microphone status and sample rate (`48.0 kHz`).

---

## 4. Page 1: Landing Page (`/`)

### 4.1 Hero Section
* **Left Column**:
  - Industrial badge: `[SPEC-2026 // AIR-GAPPED ACOUSTIC PAYMENTS]`.
  - Main Headline: **"Pay With Sound. Settled on Arc & Monad."**
  - Subtitle: Turning sound waves into an air-gapped financial transport layer. Payer devices require zero internet; keyless merchant terminals handle gas and instant on-chain broadcast.
  - Feature Pill Matrix:
    - `01. Zero Internet on Payer` (True air-gap over ggwave audible/ultrasonic sound)
    - `02. Gasless for Customer` (Arc USDC canonical EIP-3009 settlement)
    - `03. Human-Readable Merchant IDs` (ENSv2 `*.melodypay.eth` subnames)
  - Quick Action Buttons:
    - Primary Button: `Open Receiver Terminal` (`/receive`)
    - Secondary Button: `Pre-book Hardware & Name` (`/register`)
* **Right Column (Interactive Hardware & Oscilloscope Rig)**:
  - **Live WebAudio Oscilloscope / FFT Spectrum**: Interactive canvas simulating the 1.8 kHz – 2.2 kHz frequency band. Includes a *"Test Sound Wave"* button that emits a short acoustic chirping burst and drives real-time waveform displacement.
  - **Real ESP32-S3 Hardware Breakdown**: Technical schematic presentation featuring the actual breadboard hardware (referencing `public/image.png`):
    - `INMP441`: Omnidirectional I2S acoustic sensor (top).
    - `ESP32-S3`: Dual-core Xtensa MCU with onboard status LED (center).
    - `Tactile Pushbuttons`: GPIO 21 (Approve) & GPIO 22 (Reject) for hardware human-in-the-loop verification.
    - `MAX98357A`: I2S Class D mono amplifier driving the bench speaker (bottom left).
    - `OLED Screen`: 0.96" 128x64 cyan display rendering recipient, amount, and fee without truncation (bottom right).

### 4.2 Multi-Chain & Sponsor Ecosystem
* **Arc Network**: Canonical USDC precompile (`0x36...00`) via EIP-3009 `receiveWithAuthorization`. Payer signs EIP-712 typed data; merchant terminal pays gas.
* **ENSv2 on Sepolia**: `MelodyPaySubnameRegistrar.sol` issuing ERC-1155 wrapped, emancipated merchant subnames under `melodypay.eth` with forward resolver records.
* **Monad Testnet**: Sub-second finality with native EIP-1559 acoustic transfer execution.
* **Ledger Clear-Signing**: Enterprise companion signer via Ledger Device Management Kit.

### 4.3 Step-by-Step Acoustic Turn-Taking Sequence
An architectural visual timeline detailing the protocol:
1. **Invoice Broadcast**: Merchant enters amount on terminal $\to$ emits ggwave acoustic payment request (`PAY_ARC` / `PAY2`).
2. **Air-Gapped Capture**: Offline ESP32 mic captures audio $\to$ verifies CRC-8 and chain whitelist $\to$ displays recipient and amount on OLED.
3. **Physical User Approval**: Payer physically holds the "Approve" button for 2 seconds $\to$ wallet signs EIP-712 authorization $\to$ transmits signed acoustic chunks via speaker.
4. **Relay & Instant Settlement**: Keyless terminal decodes audio $\to$ verifies authorization $\to$ submits `receiveWithAuthorization` to Arc RPC $\to$ displays verifiable ArcScan receipt.

### 4.4 Security Invariants Callout
- Keyless terminal guarantee: the receiver never touches private keys.
- Hardware fail-closed architecture: invalid chain IDs, wrong gas limits, or expired nonces are automatically dropped.
- Sound is transport only: physical actuation is required before signature emission.

---

## 5. Page 2: Registration & Pre-Booking Portal (`/register`)

Designed for merchants seeking on-chain identity under `melodypay.eth` and pre-booking an ESP32 sound wallet:

### 5.1 Subname Availability & Reservation Engine
* **Interactive Search Bar**: `[ merchant-name ] .melodypay.eth`.
* **Live Sepolia RPC Resolution**: Checks if the subname node is already registered via ENS NameWrapper.
* **Status Badge**: Instant feedback (`AVAILABLE` in emerald or `ALREADY TAKEN` in amber).
* **Cost Calculation**: `1.00 USDC` (6 decimals) or native Sepolia ETH equivalent (via Chainlink AggregatorV3 price feed).

### 5.2 Settlement Profile Configuration
* **Merchant Settlement Address**: The EVM address (`0x...`) that will receive customer payments.
* **Default Payment Network**:
  - `Arc Testnet (USDC)` (Default & Recommended for $0 customer gas)
  - `Monad Testnet (MON)`
  - `Ethereum Sepolia (ETH)`

### 5.3 Keyless Execution & Reservation Ticket
Following the **Zero In-Browser Signing** directive:
* **Pre-Booking Confirmation Ticket**: Generates an industrial pass card featuring:
  - Reservation ID: `MP-2026-XXXX`
  - Subname: `[name].melodypay.eth`
  - Target Network: Arc Network / Sepolia
  - Queue Position & Status: `CONFIRMED // PENDING HARDWARE PROVISION`
* **CLI & On-Chain Execution Snippet**:
  - One-click copyable CLI command to execute registration on Sepolia:
    ```bash
    npx melodypay register [name].melodypay.eth --network sepolia --token USDC
    ```
  - Etherscan contract link and ABI reference for `MelodyPaySubnameRegistrar.sol`.

---

## 6. Page 3: Receiver POS Terminal (`/receive`)

Elevated from the existing working flow into a professional, hardware-grade merchant point-of-sale terminal:

### 6.1 Terminal Telemetry Bar & Live Oscilloscope
* **Acoustic Engine Status**: `LISTENING`, `BROADCASTING`, or `IDLE`.
* **Microphone Signal Meter**: Real-time RMS decibel level with ambient noise gate threshold.
* **Canvas Oscilloscope**: Displays real-time audio wave activity during packet transmission and reception.

### 6.2 Merchant Setup & ENS Resolver
* **Recipient Input**:
  - Enter raw `0x...` EVM address OR any registered ENS subname (e.g. `cafe.melodypay.eth`).
  - Auto-resolves on Sepolia: if verified, shows a green `[VERIFIED ENS: cafe.melodypay.eth]` badge.
* **Network & Asset Switcher**:
  - **Arc Testnet (USDC)**: Triggers EIP-3009 authorization flow.
  - **Monad Testnet (MON)**: Triggers native EIP-1559 transfer flow.
  - **Ethereum Sepolia (ETH)**: Developer testing mode.
* **Amount Pad**:
  - Direct numeric entry with quick denomination buttons (`$5`, `$10`, `$25`, `$50`, `$100`).
  - Clear separation of 6-decimal USDC units vs 18-decimal gas units.

### 6.3 State Machine & Turn-Taking Progress
Visual step indicator guiding the merchant:
1. `Setup`: Amount and recipient configured.
2. `Waiting for Wallet`: Listening for initial `ADDR|<address>` announcement tone.
3. `Fetching Context`: Fetching Arc USDC balance or on-chain nonce/fee data.
4. `Broadcasting Request`: Playing `PAY_ARC` or `PAY2` audio chunks through the speaker (attempt 1/3).
5. `Listening for Authorization`: Half-duplex turn delay (800ms quiet window), listening for `AUTH|...` chunked audio payload.
6. `Verifying Authorization`: Checking EIP-712 signature against Arc USDC contract.
7. `Submitting to RPC`: Submitting `receiveWithAuthorization` with receiver paying gas.
8. `Settled Receipt`: Transaction confirmed. Displays ArcScan / Monad explorer link and allows 1-click reset for the next invoice.

---

## 7. Verification & Testing Strategy

1. **Visual & UI Verification**:
   - Verify layout responsiveness across desktop (1440px), laptop (1024px), and mobile (390px).
   - Verify that Canvas oscilloscope runs smoothly at 60fps without memory leaks or audio clipping.
   - Verify clear light-mode contrast ratios ($\ge 4.5:1$ on text).
2. **Acoustic Transport Verification**:
   - Ensure browser audio constraints disable noise suppression, echo cancellation, and auto-gain:
     ```typescript
     { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
     ```
   - Verify ggwave encoder/decoder initialization at runtime sample rates (44.1 kHz / 48 kHz).
3. **Smart Contract & Protocol Compatibility**:
   - Verify EIP-3009 typed data encoding against Arc Testnet USDC contract `0x3600000000000000000000000000000000000000`.
   - Verify ENS subname forward resolution against Sepolia NameWrapper.
4. **Clean Build & Lint Checks**:
   - Run `npm run build` (`tsc && vite build`) to confirm zero TypeScript compilation errors.
   - Run existing vitest test suite (`npm test`).
