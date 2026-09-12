# Landing Page Architecture & Full Experience Specification

## Overview
Design and implement the complete, production-grade landing page for MelodyPay, following the editorial industrial light-mode aesthetic and the user's explicit section structure:
1. **Hero Section** (Completed & Refined)
2. **Features** (Acoustic Air-Gap, Gasless EIP-3009, Hardware Enclave, ENSv2 Identity, Keyless POS, Multi-Chain Settlement)
3. **How It Works** (5-Step Visual Protocol Flow from invoice broadcast to instant settlement)
4. **Prototype Sneak Peek** (Interactive showcase featuring the real ESP32-S3 breadboard hardware photo with component hotspots + 3D teardown / oscilloscope telemetry)
5. **FAQs** (Interactive clean accordion addressing cryptographic security, ambient noise, gasless mechanics, and open hardware)
6. **Footer** (Architectural footer with fanned card stack logo, navigation matrices, cursive ribbon wave, and system telemetry)

---

## 1. Section Specifications

### 1.1 Hero Section (Preserved & Enhanced)
- Panoramic landscape header image (`/image copy 3.png`) with space behind the floating architectural header.
- Delicate cursive *"Pay with sound"* 3-line musical stave ribbon with floating musical notes and traveling light pearl.
- Split editorial headline row:
  - Left: `"Air-gapped by sound. Sign offline. Settle on-chain."`
  - Right: Concise copy + `"Launch Terminal"` & `"Pre-book Device & ENS ➔"` CTAs.
- Telemetry ticker strip marquee with protocol specifications.

### 1.2 Features Section (`#features`)
- **Theme**: Clean editorial grid with subtle borders, muted neutral backgrounds, and high-contrast typography.
- **Header**: Section pill `// PROTOCOL CAPABILITIES`, Title: `"Engineered for Physical Money in the Digital Age"`.
- **6 Core Feature Cards**:
  1. **Acoustic Air-Gap Wire**: Zero radio frequencies (no Bluetooth, Wi-Fi, or cellular). Transmits encrypted EIP-3009 payloads purely over audible/ultrasonic sound waves.
  2. **Gasless EIP-3009 Payments**: Customers pay with pure USDC. Zero gas tokens needed—the merchant terminal acts as a gas relayer on Arc and Monad.
  3. **Human Confirmation Enclave**: Physical tactile switch on offline ESP32-S3 silicon guarantees human intent before signing.
  4. **Decentralized ENSv2 Identity**: Emancipated subnames under `*.melodypay.eth` with forward address resolution and Arc network routing text records.
  5. **Keyless Point-of-Sale**: Any web browser, smartphone, or tablet can run the receiver terminal with zero custody and zero private key exposure.
  6. **Sub-Second Settlement**: Native Arc USDC precompile (`0x36...00`) and Monad 10,000 TPS engine for near-instant transaction finality.

### 1.3 How It Works (`#how-it-works`)
- **Theme**: Sequential 5-step interactive protocol pipeline with visual badges and micro-illustrations.
- **Header**: Section pill `// ARCHITECTURAL FLOW`, Title: `"From Sound Wave to Finality in 800ms"`.
- **5 Sequential Steps**:
  - **Step 01: Invoice Broadcast (POS)**: Terminal generates EIP-3009 authorization request and emits modulated acoustic audio into the room.
  - **Step 02: Air-Gapped Listening (Hardware)**: Offline ESP32-S3 hardware listens via INMP441 I2S microphone, demodulating the audio buffer directly in memory.
  - **Step 03: Clear-Signing Review (User)**: OLED screen displays the exact merchant ENS name and USDC amount. User presses physical button.
  - **Step 04: Acoustic Signature Emission**: Hardware signs with secp256k1 private key and broadcasts an acoustic signature burst via I2S DAC amplifier.
  - **Step 05: Instant On-Chain Settlement**: POS captures signature and submits `receiveWithAuthorization` to Arc/Monad with $0 customer gas.

### 1.4 Prototype Sneak Peek (`#prototype`)
- **Theme**: Showcase authentic real-world engineering combining the physical working breadboard photo and interactive hardware telemetry.
- **Header**: Section pill `// PHYSICAL SILICON`, Title: `"Working Prototype in the Wild"`.
- **Visual Components**:
  - **Real Hardware Callout Card**: High-resolution showcase of the physical breadboard prototype (`/image.png`) with interactive numbered hotspots:
    - 1. *ESP32-S3 Microcontroller* (Cryptographic signing enclave with zero network stacks)
    - 2. *INMP441 I2S Digital Microphone* (High-precision acoustic capture)
    - 3. *MAX98357A I2S DAC & Speaker* (Acoustic audio signature emitter)
    - 4. *0.96" Monochrome OLED Display* (Tamper-proof clear-signing viewport)
    - 5. *Tactile Confirmation Switches* (Physical air-gap authorization)
  - **Telemetry & 3D Teardown Tabs**: Toggle between the physical photo inspection, the 3D interactive exploded view (`HardwareTeardown`), and real-time acoustic spectrum bench (`AcousticOscilloscope`).

### 1.5 Frequently Asked Questions (`#faqs`)
- **Theme**: Accessible, high-end accordion with smooth animations and crisp authoritative answers.
- **Header**: Section pill `// CLARIFICATIONS & SECURITY`, Title: `"Frequently Asked Questions"`.
- **Key Questions**:
  1. *Can an eavesdropper replay the acoustic sound wave?*
  2. *Does the payer need ETH or native gas tokens?*
  3. *How does acoustic transmission perform in noisy environments?*
  4. *Why choose acoustic waves over NFC or QR codes?*
  5. *What chains are supported today?*
  6. *Is the hardware and firmware fully open-source?*

### 1.6 Footer (`footer`)
- Architectural dark-accented footer:
  - Brand identity with the fanned diagonal "MP" payment card stack logo + "MelodyPay" wordmark.
  - Multi-column site navigation: Product, Networks, Developers, Resources.
  - The signature cursive `MelodyPayStaffRibbon` wave across the bottom.
  - Live system status badge: `● All Systems Operational // Air-Gapped by Design`.
  - Copyright and GitHub repository link.

---

## 2. Invariants & Constraints
- **Audio Silence**: Strictly preserve the user rule: all sound synthesizer/oscillator effects remain 100% disabled/silenced.
- **Static Logo**: Fanned diagonal card stack logo remains pure vector SVG.
- **Aesthetic Excellence**: Clean, high-contrast light-mode editorial design (`#FBFBF9` background, `#111113` typography, `#E2E2DA` borders, subtle `#0088FF` & `#836EF9` accents).
