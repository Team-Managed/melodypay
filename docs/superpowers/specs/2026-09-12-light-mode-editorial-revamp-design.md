# MelodyPay Frontend Light Mode Revamp: Editorial Minimalist Architecture

> **Status:** Approved Design Specification  
> **Date:** 2026-09-12  
> **Target Theme:** Light Mode — Editorial Minimalist Studio  
> **Reference Layout:** Framed Meadow Artwork Centerpiece with Overlay Cursive Stave + Editorial Typography Row  

---

## 1. Executive Summary & Goals

MelodyPay is revamping its frontend into a clean, high-contrast, editorial **Light Mode** design inspired by modern premium studio aesthetics. The layout features a floating dark pill navbar, a grand framed artistic centerpiece with an animated musical stave overlay, a split editorial headline and description row below, and a dedicated light-mode hardware teardown section.

### Key Architectural Invariants
1. **Air-Gapped Sound Payments**: Offline hardware wallet (ESP32-S3) signs EIP-712 digests without WiFi, Bluetooth, or cellular connections.
2. **Keyless Merchant POS Terminal**: Untrusted receiver browser never touches private keys, acts purely as acoustic listener and RPC relayer.
3. **No Breadboard in Hero**: The 3D hardware breadboard is strictly located in the dedicated Silicon Teardown section (`#hardware`), keeping the Hero section focused on the artistic centerpiece and editorial typography.
4. **Hero Centerpiece Overlay**: The framed centerpiece displays the green meadow with soaring white birds (`public/image copy 2.png`) with the glowing white 5-line musical stave animation from `PayForSoundStaffRibbon.tsx` tracing out **"Pay with Sound"** across the sky with traveling harmonic pulses and musical notes (`♪ ♫ ♬`).
5. **Unified Design Tokens**: Warm off-white canvas (`#FBFBF9`), crisp carbon typography (`#111113`), secondary slate (`#4B4B52`), 1px architectural borders (`#E2E2DA`), and subtle engineering dot/grid lines unifying Home (`/`), POS Terminal (`/receive`), and Pre-Booking Registrar (`/register`).

---

## 2. Layout & Component Architecture

### 2.1 Floating Dark Pill Navbar (`StudioHeader.tsx`)
- **Position**: Fixed top-center floating pill (`top-4 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-4xl`).
- **Container**: Sleek dark charcoal pill (`bg-[#111113] border border-neutral-800 rounded-full px-5 py-2.5 shadow-2xl flex items-center justify-between text-white`).
- **Left**: Sparkle icon + `MelodyPay` brand name + live status pulse badge (`[ARC USDC]`).
- **Center**: Nav items (`Terminal`, `Register`, `Hardware`, `Oscilloscope`, `Ecosystem`).
- **Right**: Inset white pill CTA button (`bg-white text-black font-semibold rounded-full px-4 py-1.5 text-xs hover:bg-neutral-200 transition-all shadow-sm`) linking to `/receive` ("Launch Terminal").

### 2.2 Hero Section (`Home.tsx`)
- **Container**: `w-full bg-[#FBFBF9] text-[#111113] pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-12`.
- **Top / Centerpiece Visual Frame**:
  - A framed, rounded rectangular canvas container (`max-w-6xl mx-auto h-[380px] sm:h-[480px] lg:h-[540px] rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E2E2DA] shadow-xl relative bg-[#F5F5F0]`).
  - **Background Layer**: The lush green meadow with flying white birds (`public/image copy 2.png`) rendered with `w-full h-full object-cover object-center`.
  - **Overlay Layer**: The `PayForSoundStaffRibbon` component mounted as an absolute overlay, rendering the 5-line musical stave in glowing white cursive calligraphy spelling **"Pay with Sound"** across the meadow with traveling harmonic pulses and floating musical notes.
  - **Controls**: Discreet floating audio mute / play toggle in the bottom-right corner of the frame.
- **Bottom / Editorial Typography Split Row**:
  - Sits directly below the framed artwork (`max-w-6xl mx-auto mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start`).
  - **Left Column (lg:col-span-7)**:
    - High-impact editorial headline with tight tracking:
      ```
      Pay with sound.
      Air-gapped on Arc & Monad.
      ```
      using `text-4xl sm:text-5xl lg:text-[3.75rem] font-bold tracking-tight text-[#111113] leading-[1.08] font-sans`.
  - **Right Column (lg:col-span-5 flex flex-col items-start pt-2)**:
    - Editorial explanatory copy:
      *"Execute secure, air-gapped crypto transactions across multichain networks using high-frequency acoustic waves. Your hardware wallet signs completely offline — settled gaslessly on Arc & Monad."*
    - **Black Pill Action Button**:
      `Launch Terminal` (`bg-[#111113] hover:bg-black text-white px-7 py-3 rounded-full text-sm font-semibold transition-all shadow-md flex items-center gap-2 group`).
    - Secondary text link:
      `Pre-book Device & ENS ➔` (`text-sm font-mono text-[#4B4B52] hover:text-[#111113] transition-colors mt-3`).

---

## 3. Down-Page Sections (Light Mode Studio Engineering)

### 3.1 Ticker Telemetry Strip
- Engineering ribbon: `bg-[#F5F5F0] text-[#111113] border-y border-[#E2E2DA] py-3.5`.
- Monospace uppercase ticker items with cyan/purple bullet delimiters.

### 3.2 Hardware Architecture & Silicon Teardown (`#hardware`)
- Clean white cards (`bg-[#FFFFFF] border border-[#E2E2DA] rounded-xl p-6`).
- Dedicated home for the interactive 3D ESP32-S3 Hardware Breadboard (`Hardware3DScene.tsx` with light studio background lighting).
- Exploded view slider (`0%` to `100%`) and tactile component selector buttons with Monad purple and Arc cyan active accents.

### 3.3 Live Acoustic Telemetry Bench (`#oscilloscope`)
- Real-time WebAudio oscilloscope and FFT frequency analyzer (`AcousticOscilloscope.tsx`) inside clean white drafting bench frame.
- Interactive test chirp burst simulation (1875 Hz – 2187 Hz).

### 3.4 Multi-Chain Smart Contract Infrastructure (`#ecosystem`)
- 4 grid cards on `#FFFFFF` with `#E2E2DA` borders:
  1. **Arc Network**: Canonical USDC precompile (`0x36...00`), EIP-3009 gasless transfers.
  2. **ENSv2 Subname Registrar**: Wrapped emancipated merchant subnames on Sepolia.
  3. **Monad Testnet**: Sub-second finality native acoustic EIP-1559 execution.
  4. **Ledger Clear-Signing**: Companion air-gapped hardware signer via Ledger DMK.

### 3.5 Protocol Turn-Taking Sequence & Invariants
- Visual 4-step sequence:
  `Invoice Broadcast ➔ Air-Gapped Capture ➔ Physical Button Approval ➔ Relay & Instant Settlement`.
- Security callout box highlighting keyless receiver guarantees.

### 3.6 Protocol Signature Footer
- Warm ivory footer with cursive `MelodyPay` stave ribbon wave animation (`MelodyPayStaffRibbon.tsx`).

---

## 4. Verification Plan

1. **Visual Regression & Layout Match**:
   - Floating dark pill navbar matches reference design.
   - Framed centerpiece displays `image copy 2.png` with overlaid cursive "Pay with Sound" 5-line stave ribbon animation.
   - Editorial typography split row displays bold left headline and right paragraph + black CTA pill.
   - Zero breadboard elements inside the hero section.
   - 3D breadboard renders cleanly in the dedicated hardware teardown section (`#hardware`).
2. **Automated Testing**:
   - Run `npm test` to ensure all 30/30 unit tests pass.
   - Run `npm run build` to verify clean TypeScript compilation with zero errors.
