# Frontend Industrial Studio UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the MelodyPay frontend into a light-mode Industrial Studio & Hardware Engineering suite comprising the Landing Page (`/`), Pre-booking & ENS Registration Portal (`/register`), and Keyless POS Terminal (`/receive`) with real-time WebAudio oscilloscope and hardware schematics.

**Architecture:** A modular React + Tailwind + Framer Motion suite. Keyless by design: the receiver never holds keys and requires zero in-browser wallet signing. Integrates Arc Network (USDC EIP-3009 gasless settlement), Ethereum Sepolia ENSv2 subnames (`*.melodypay.eth`), Monad Testnet native transfers, and the physical ESP32-S3 breadboard hardware.

**Tech Stack:** TypeScript, React 18, Vite, Tailwind CSS 3.4, Framer Motion, Lucide React, ethers v6, WebAudio API (Canvas FFT & Oscilloscope), ggwave.

---

## Global Constraints

- Theme: Strict Light Mode — Industrial Studio & Hardware Engineering.
- Colors: Canvas backdrop `#FBFBF9`, borders `#E2E2DA`, ink primary `#111113`, telemetry cyan `#0088FF`, emerald `#10B981`, amber `#F59E0B`.
- Zero In-Browser Signing: Keyless receiver and registration portals. No `window.ethereum` popups. Registration generates CLI commands and reservation passes.
- Scope: Exactly three routes:
  1. `/` — Landing Page (Acoustic Hero, Live Oscilloscope, Physical Breadboard Hardware Teardown, Protocol Sequence, Multi-Chain Matrix).
  2. `/register` — Pre-booking & Merchant Subname Portal (Sepolia ENS availability, Arc settlement configuration, industrial ticket, CLI snippet).
  3. `/receive` — Receiver POS Terminal (Acoustic signal telemetry, live waveform, ENS resolution badge, Arc USDC EIP-3009 + Monad flow, verifiable receipt).
- Maintain 100% existing protocol and smart contract compatibility (Arc Testnet `5042002`, USDC `0x3600000000000000000000000000000000000000`, Monad `10143`, Sepolia `11155111`).

---

## File Structure Plan

- Modify `tailwind.config.js`: Add industrial studio colors (`app-canvas`, `app-border`, `app-ink`, `app-cyan`, `app-amber`, `app-emerald`) and monospace font rules.
- Modify `receiver-web/src/index.css`: Add drafting grid patterns, scanline utilities, and custom scrollbars.
- Create `receiver-web/src/components/StudioHeader.tsx`: Unified industrial command header with network telemetry and audio status.
- Create `receiver-web/src/components/AcousticOscilloscope.tsx`: Real-time Canvas oscilloscope and FFT audio spectrogram reacting to WebAudio.
- Create `receiver-web/src/components/HardwareTeardown.tsx`: Tactile interactive schematic and hardware teardown showcasing the real ESP32 breadboard (referencing `public/image.png`).
- Modify `receiver-web/src/pages/Home.tsx`: Complete revamp of the Landing Page.
- Create `receiver-web/src/pages/Register.tsx`: Dedicated Pre-booking & ENS Merchant Subname Registration portal.
- Modify `receiver-web/src/pages/ReceivePayment.tsx`: Elevated industrial POS terminal with live signal telemetry, ENS badge, Arc USDC EIP-3009 and Monad native transfer.
- Modify `receiver-web/src/App.tsx`: Routing update to bind `/`, `/register`, `/receive` under `StudioHeader`.
- Test: `tests/ui-components.test.ts` to test utility functions, validation, and fee/amount conversions.

---

### Task 1: Design System Foundation & Studio Header Shell

**Files:**
- Modify: `tailwind.config.js`
- Modify: `receiver-web/src/index.css`
- Create: `receiver-web/src/components/StudioHeader.tsx`
- Modify: `receiver-web/src/App.tsx`

**Interfaces:**
- Produces: `StudioHeader` component rendering brand logo, route links (`/`, `/register`, `/receive`), network telemetry chips (`Arc 5042002`, `Monad 10143`, `Sepolia 11155111`), and system status badge.

- [ ] **Step 1: Configure Tailwind tokens and CSS utilities**
Extend `tailwind.config.js` with industrial studio tokens and update `receiver-web/src/index.css` with technical micro-grid backgrounds.
- [ ] **Step 2: Create `StudioHeader.tsx`**
Implement the header with active route indicator, network status pills, and audio telemetry pill.
- [ ] **Step 3: Update `App.tsx`**
Wire routes for `/`, `/register`, and `/receive`, replacing previous layout with the studio drafting frame.
- [ ] **Step 4: Verify build**
Run `npm run build` to confirm zero compilation errors.

---

### Task 2: Real-time WebAudio Oscilloscope & Spectrum Analyzer

**Files:**
- Create: `receiver-web/src/components/AcousticOscilloscope.tsx`
- Test: `tests/ui-oscilloscope.test.ts`

**Interfaces:**
- Produces: `<AcousticOscilloscope height={120} interactive={true} active={boolean} />`
- Consumes: WebAudio `AudioContext`, `AnalyserNode` with fallback synthetic acoustic generator for testing chirping tones (`1.8 kHz - 2.2 kHz`).

- [ ] **Step 1: Write test for audio frequency helpers**
Verify FSK tone frequency calculation and decibel normalization functions.
- [ ] **Step 2: Implement `AcousticOscilloscope.tsx`**
Canvas component drawing dual views:
1. Waveform oscilloscope (time-domain displacement).
2. Frequency bars (frequency-domain FFT spikes around 1800–2200 Hz).
3. "Test Acoustic Pulse" button generating a short 1950Hz audible chirp.
- [ ] **Step 3: Verify Canvas render and cleanup**
Ensure audio contexts and requestAnimationFrame loops cleanly terminate on unmount.

---

### Task 3: Interactive Physical Breadboard Hardware Teardown

**Files:**
- Create: `receiver-web/src/components/HardwareTeardown.tsx`

**Interfaces:**
- Produces: `<HardwareTeardown />` displaying the authentic physical ESP32-S3 breadboard from `public/image.png` with interactive pinout callouts and live OLED simulator.

- [ ] **Step 1: Create `HardwareTeardown.tsx`**
Render high-resolution prototype imagery (`/image.png`) with interactive annotated hotspots:
- `INMP441 Microphone`: GPIO 4, 5, 6 (I2S DMA).
- `ESP32-S3 MCU`: Dual-Core Xtensa LX7, USB-C OTG, fail-closed signing boundary.
- `Tactile Switches`: GPIO 21 (Approve) & GPIO 22 (Reject) physical human-in-the-loop verification.
- `MAX98357A I2S DAC/Amp`: Class D speaker amplifier for acoustic response transmission.
- `0.96" Cyan OLED`: 128x64 display rendering recipient, amount, fee, and authorization digest without truncation.
- [ ] **Step 2: Add interactive state switcher**
Allow clicking each module to view technical pinouts, hardware constraints, and electrical specifications.

---

### Task 4: Complete Industrial Studio Landing Page

**Files:**
- Modify: `receiver-web/src/pages/Home.tsx`

**Interfaces:**
- Produces: Full Landing Page containing:
  1. Hero Section (Value prop, CTAs, live `<AcousticOscilloscope />`, and `<HardwareTeardown />`).
  2. Protocol Turn-Taking Sequence (4-step visual timeline: Invoice $\to$ Air-gapped Capture $\to$ Physical Button Hold $\to$ Instant Settlement).
  3. Multi-Chain Matrix (Arc Network USDC EIP-3009, ENSv2 Sepolia subnames, Monad Testnet, Ledger clear-signing).
  4. Security Invariants & Fail-Closed Boundaries.
  5. Industrial Ticker & Footer.

- [ ] **Step 1: Rebuild `Home.tsx`**
Implement the light-mode industrial layout incorporating the approved copy, interactive oscilloscope, hardware teardown, and protocol diagrams.
- [ ] **Step 2: Verify responsive design**
Test on desktop and mobile viewports.

---

### Task 5: Pre-Booking & ENS Merchant Subname Portal

**Files:**
- Create: `receiver-web/src/pages/Register.tsx`
- Test: `tests/ui-register.test.ts`

**Interfaces:**
- Produces: Dedicated page at `/register` featuring:
  1. ENS subname search: `[ ________ ] .melodypay.eth` with live Sepolia RPC availability check.
  2. Pricing & Cost calculator: `1.00 USDC` or native ETH conversion.
  3. Merchant Settlement Configuration: recipient address and preferred settlement network (Arc USDC default).
  4. Industrial Pre-Booking Pass: Printable/copyable reservation card with unique queue ID.
  5. Keyless CLI snippet generator: `npx melodypay register [subname].melodypay.eth --network sepolia`.

- [ ] **Step 1: Write tests for subname validation & CLI generator**
Unit test subname regex validation (`[a-z0-9-]+`) and CLI command string generator.
- [ ] **Step 2: Implement `Register.tsx`**
Build the complete interactive reservation workstation adhering to the Zero In-Browser Signing rule.
- [ ] **Step 3: Verify build**
Confirm zero TypeScript errors.

---

### Task 6: Elevated Receiver POS Terminal

**Files:**
- Modify: `receiver-web/src/pages/ReceivePayment.tsx`

**Interfaces:**
- Produces: High-precision keyless Point-of-Sale terminal at `/receive` featuring:
  1. Live acoustic signal telemetry bar with real-time waveform inspection.
  2. Recipient input with automatic Sepolia ENS subname resolution (`cafe.melodypay.eth` $\to$ `0x...`) and `[VERIFIED ENS]` badge.
  3. Multi-chain selector: Arc Testnet (USDC EIP-3009 gasless for customer), Monad Testnet (MON), Sepolia (ETH).
  4. Tactile amount keypad with quick-select denomination pills.
  5. 8-step acoustic turn-taking state machine with visual packet progress.
  6. Instant on-chain receipt with ArcScan / Monad explorer links and 1-click invoice reset.

- [ ] **Step 1: Update `ReceivePayment.tsx`**
Incorporate the industrial studio aesthetic, live oscilloscope header, ENS resolver badge, and polished audio turn-taking state machine.
- [ ] **Step 2: Test audio transmission and fallback simulation**
Verify that payment requests and chunked listening work with full browser audio constraint flags (`echoCancellation: false`).

---

### Task 7: Verification, Test Suite & Browser Validation

**Files:**
- Test: `tests/`
- Documentation: `context/progress-tracker.md`

- [ ] **Step 1: Run unit tests**
Execute `npm test` to verify that all config, EIP-3009, and receiver tests pass.
- [ ] **Step 2: Run production bundle build**
Execute `npm run build` (`tsc && vite build`) to ensure 100% clean type check and bundle generation.
- [ ] **Step 3: Browser validation**
Validate navigation across `/`, `/register`, and `/receive`, confirming visual fidelity, responsive layout, and acoustic audio triggers.
- [ ] **Step 4: Update Progress Tracker**
Update `context/progress-tracker.md` to record completion of the UI/UX revamp phase.
