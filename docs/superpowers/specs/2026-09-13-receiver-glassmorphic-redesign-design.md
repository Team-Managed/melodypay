# Receiver Page Glassmorphic Redesign Specification

## 1. Overview
Harmonize the `/receive` route (`ReceivePayment.tsx`) with the design language established on the `/register` page (`Register.tsx`). The layout shifts from an opaque, mismatched 12-column blue/green split into a balanced, dual-column transparent glassmorphic terminal over full-bleed aerial meadow photography, ensuring high visual cohesion, zero-scroll desktop fit, and seamless live acoustic telemetry.

---

## 2. Visual & Layout Architecture

### 2.1 Page Canvas & Atmospheric Layer
* **Background Image**: Fixed full-bleed aerial meadow photography (`/image copy 2.png`) with `scale-105` to eliminate white borders during viewport scaling.
* **Ambient Overlays**:
  * Multi-stop dark gradient vignette (`from-black/45 via-black/25 to-black/55`).
  * Dark emerald color wash (`bg-[#0d281a]/20`) with subtle backdrop blur (`backdrop-blur-[0.5px]`) for enhanced contrast, depth, and legibility.
* **Viewport Dimensions**:
  * Root container: `flex-1 flex flex-col justify-center w-full min-h-screen lg:h-screen lg:max-h-screen overflow-hidden py-6 sm:py-8 pt-20 sm:pt-24 lg:pt-26 font-sans selection:bg-[#38BDF8]/20 selection:text-white`.
  * Single-screen viewport fit on desktop displays (`max-h-screen`) with proportional clearances underneath `StudioHeader`.

### 2.2 Top Editorial Header
* **Eyebrow Tag**: `// AIR-GAPPED ACOUSTIC POS TERMINAL` in `font-mono text-[#38BDF8] uppercase tracking-[0.22em] text-[11px] font-semibold mb-2 block drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]`.
* **Headline**: `text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] font-sans leading-[1.12]` with sub-heading in `text-white/85 font-normal`:
  * Line 1: "Receive Sound Payments."
  * Line 2: "Air-gapped acoustic wire. Settled on Base."
* **Subtext**: Clean sans-serif description (`text-sm sm:text-base font-sans text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] mt-2 sm:mt-2.5 leading-relaxed max-w-xl mx-auto`).

---

## 3. Dual Glassmorphic Cards Structure

Both cards reside within a symmetrical 2-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 items-stretch flex-1 lg:max-h-[520px]`), sharing identical glassmorphic surface tokens:
* Background: `bg-white/[0.07]`
* Backdrop filter: `backdrop-blur-2xl`
* Border & Ring: `border border-white/25 ring-1 ring-white/10`
* Radius & Shadow: `rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.25)]`
* Layout: `flex flex-col justify-between h-full p-5 sm:p-6`

### 3.1 Left Column: Payment Terminal Controls
1. **Wallet Status Header**:
   * Compact glass card (`bg-white/[0.08] border border-white/20 rounded-xl p-2.5 px-3.5`).
   * Displays connection state (`Wallet Active` vs `No Wallet Connected`) with active status icon and truncated address (`0x1234...5678`).
   * Actions: "Connect" (solid white button) or "Disconnect" (subtle white text button).
   * Network Warning: If connected to an unsupported chain, provides a 1-click "Switch to Base Sepolia" button.
2. **Merchant Recipient Address Input**:
   * Label: `Merchant Recipient Address` with `Autofilled from Wallet` indicator when active.
   * Input: `bg-white/[0.08] border border-white/25 focus:border-white focus:bg-white/[0.14] rounded-lg px-3.5 py-2.5 text-xs font-mono text-white placeholder-white/40`.
3. **Invoice Amount & Presets**:
   * Input: Large bold typography (`text-2xl sm:text-3xl font-bold font-mono text-white`) with right-aligned `USDC` currency badge.
   * Quick Presets: Flat translucent glass pills for `$1.00`, `$5.00`, `$10.00`, and `$25.00` with active state highlighting (`bg-white text-black font-bold` when selected, `bg-white/10 hover:bg-white/20 text-white` when idle).
4. **Interactive Turn-Taking Feedback**:
   * When listening/broadcasting/verifying, renders an inline glass feedback card with animated status icon, step label (`PHASE 01-06 // ACOUSTIC ENGINE`), detailed description, and a "Cancel Request" action.
5. **Settlement State & Actions**:
   * When payment settles: Displays verified checkmark, amount received, transaction hash with copy and BaseScan explorer links.
   * Action buttons: "View Thermal POS Receipt" (`/receipt`) and "Receive Next Payment".
6. **Primary Action Button**:
   * Crisp solid white button (`bg-white hover:bg-white/90 text-black py-3 px-5 rounded-xl text-sm font-sans font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer`).

### 3.2 Right Column: Acoustic Telemetry & Oscilloscope
1. **Header**:
   * Telemetry badge (`// ACOUSTIC SOUND TELEMETRY`) with live indicator (`STANDBY`, `LISTENING (MIC ACTIVE)`, or `BROADCASTING INVOICE`) and animated white pulse light.
2. **Oscilloscope Core**:
   * `AcousticOscilloscope` component rendered in transparent dark mode (`transparentBg={true}`, `darkMode={true}`) spanning ~280-320px height, smoothly plotting the shared microphone waveform and FFT frequency spectrum without duplicate audio streams.
3. **Protocol Specifications Matrix**:
   * Compact 4-point architectural checklist matching Register's right card:
     * **Acoustic Air-Gap Wire**: Ultrasound FSK modulated audio packet transfer via ggwave.
     * **Zero Radios Required**: Payer hardware remains strictly offline without Wi-Fi or Bluetooth.
     * **EIP-3009 Gasless Settlement**: On-chain transfer authorization relayed by the merchant terminal.
     * **Tactile Approval Switch**: Physical button authorization prevents replay and automated draining.

---

## 4. Verification & Testing
1. **Visual Fit**: Confirm `ReceivePayment.tsx` renders cleanly within viewport on desktop (1080p and laptop screens) without double scrollbars.
2. **State Consistency**:
   * Standby state -> Form inputs editable, presets selectable.
   * Turn-taking state -> Live acoustic listening triggers mic permissions, oscilloscope shows dynamic waves, cancel button halts listeners.
   * Done state -> POS receipt redirection and local storage persistence work reliably.
3. **Responsive Degradation**: Mobile viewports stack cards vertically with natural layout flow and sticky bottom actions.
4. **Build & Test**: Run `npm run build` and Vitest test suite to confirm zero errors or regressions.
