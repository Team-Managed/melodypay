# MelodyPay Progress Tracker

## Current Phase
- **Phase**: UI/UX Design and Frontend Implementation.
- **Active Branch**: `feat/ui-ux` (base: `feat/smart-contracts-implementation` at `25428d7`).

## Architecture Decisions & Consensus
1. **Arc Network Payments**:
   - Contract: `MelodyPaySettlement.sol` deployed on Arc Network.
   - Leverages Arc's canonical native USDC precompile at `0x3600000000000000000000000000000000000000` via EIP-3009.
   - Provides POS invoice/order tracking (`orderId => settlement nonce`) and emits `SoundPaymentSettled` receipt events.
   - Supports both `receiveWithAuthorization` and `transferWithAuthorization`.
2. **ENS Merchant Subname Registrar (Sepolia)**:
   - Contract: `MelodyPaySubnameRegistrar.sol` under `melodypay.eth` root domain.
   - Uses official ENS `NameWrapper` (`0x0635513f179D50A207757E05759CbD106d7dFcE8` on Sepolia).
   - Dual payment: 1.0 USDC (6 decimals) or Native ETH (Chainlink AggregatorV3Interface with exact refund).
   - Beneficiary / Treasury: `0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF`.
   - Emancipated subnames with `PARENT_CANNOT_CONTROL` fuse (65536).
   - Sets forward address resolution on default resolver.

## Status of Tasks
- [x] Configure Foundry workspace (`foundry.toml`, `.gitignore`).
- [x] Standard interfaces: `IERC20`, `IERC3009`, `AggregatorV3Interface`, `IAddrResolver`, `INameWrapper`, `IMelodyPaySettlement`, `IMelodyPaySubnameRegistrar`.
- [x] Core security modules: `SafeERC20`, `Ownable2Step`, `Pausable`, `ReentrancyGuard`, `ERC1155Holder`.
- [x] Implement `MelodyPaySubnameRegistrar.sol` on Sepolia.
- [x] Implement `MelodyPaySettlement.sol` on Arc.
- [x] Create deployment scripts: `DeployRegistrar.s.sol` (Sepolia) and `DeploySettlement.s.sol` (Arc).
- [x] Compile and verify via `forge build --root contracts`.
- [x] Write and run Foundry test suite: 30 tests passing (21 for Registrar, 9 for Settlement).
- [x] Update `contracts/README.md`.
- [x] Synchronize spec and plan documents (`2026-09-12-arc-ens-ledger-eip3009-design.md` and `2026-09-12-arc-ens-ledger-eip3009.md`).
- [x] Commit Task 1 via `/git-commit`.
- [x] Task 2: Add Arc Network and USDC Profiles (`receiver-web/src/core/chains.ts`, `tokens.ts`, `cli/src/chains.ts`, `tests/arc-config.test.ts`).
- [x] Task 3: Implement Canonical EIP-3009 Typed Data (`receiver-web/src/core/eip3009.ts`, `receiver-web/src/core/payment-protocol.ts`, `tests/eip3009.test.ts`).
- [x] Task 4: Add Arc EIP-3009 Receiver Flow in Web & CLI (`receiver-web/src/pages/ReceivePayment.tsx`, `receiver-web/src/core/tx-builder.ts`, `cli/src/receiver.ts`, `tests/arc-receiver-flow.test.ts`).
- [x] Task 5: Add ESP32 EIP-3009 Signing Boundary (`esp32/components/eip3009/`).
- [x] Task 8: Industrial Studio Light Mode UI/UX Revamp:
  - [x] Light Mode Editorial Revamp (`Home.tsx`, `StudioHeader.tsx`, `PayForSoundStaffRibbon.tsx`):
    - Background panoramic landscape banner (`/image copy 3.png`) spanning full-width with clean cut to split editorial text.
    - Beautiful, 100% recognizable cursive script typography for "Pay with sound" rendered in luminous white with soft drop-shadow, with true Spencerian cursive capital "S" anatomy (slanted upstroke, apex crest, serpentine descending waist, generous right-hand lower belly, and seamless clasp into "o").
    - Three distinct, parallel undulating musical stave lines with a traveling acoustic wave pulse, glowing light pearl, and floating musical notes.
    - Completely removed all floating pill badges (the `EVM LIVE` badge in the navbar and the `AIR-GAPPED ACOUSTIC WIRE` badge over the hero image) and removed the header logo icon for clean, minimal typography.
    - Hero copy updated to be short and crisp: "Sound waves as an air-gapped financial wire. Offline hardware signs transactions with physical button confirmation, settled instantly on-chain via keyless terminals."
    - Refined headline scale to a crisp editorial hierarchy (`text-2xl sm:text-3xl lg:text-4xl xl:text-[2.75rem]`).
    - Designed and integrated the official Fanned Diagonal "MP" Payment Card Stack Logo (`MelodyLogoM.tsx`) into `StudioHeader.tsx` and as site favicon (`public/favicon.svg`, `index.html`):
      - Two payment cards arranged in a dynamic diagonal fanned spread:
        - Back Card tilted at -24°, offset up-left, with dark matte body, subtle magnetic stripe accent, and white border peeking out behind.
        - Front Card tilted at -10°, foreground payment card with EMV acoustic chip, contact grid lines, contactless sound waves, and bold italic "MP" payment network brandmark in Visa typography.
      - 100% static, crisp vector SVG with zero timers and zero CPU overhead.
      - Integrated natively into `index.html` and `public/manifest.webmanifest` as `/favicon.svg` for sharp tab rendering on Retina and standard screens.
      - All sound effects, chimes, and test tone oscillators silenced across all components on the website per strict user requirement.
    - Completed full landing page experience (`receiver-web/src/pages/Home.tsx`):
      - Hero Section (cinematic panorama banner, cursive stave ribbon, split headline, CTAs, and protocol ticker strip).
      - Features Section (Acoustic Air-Gap Wire, Gasless EIP-3009, Hardware Intent Switch, ENSv2 Subname Registrar, Menu-Driven CLI Dashboard & USB Device Manager, and Line-Oriented REPL Control Protocol with `ggwave_transport.cpp`).
      - How It Works Section (5-step visual pipeline from POS invoice chime to instant on-chain settlement).
      - Prototype Sneak Peek Section:
        - Open staircase scrollytelling experience on light meadow green background (`bg-[#EBF4EE]`, `border-y border-[#D6E6DB]`).
        - Ditched all heavy card boxes, nested frames, and explosion sliders; 3D ESP32-S3 model rendered fully assembled (`explosionProgress={0}`).
        - Replaced restrictive ancestor clipping in `App.tsx` (`overflow-hidden` -> `overflow-x-clip`) to restore native CSS `position: sticky` functionality.
        - Pinned sticky prototype screen: viewport sticks at `top: 0` throughout the scroll track until all features are covered and the user is seeing the last one (Feature 05).
        - Directional staircase transitions via Framer Motion `AnimatePresence mode="wait"` and `useMotionValueEvent`: current feature exits (slides up and fades out) while the next feature enters from below (and vice versa in reverse).
        - Eliminated dead space / huge gap before FAQs: when the sticky container finishes on Feature 05, `#faqs` rolls into view immediately with natural layout padding.
        - Single clean subtitle line placed directly below "Prototype Sneak Peek" header: "Scroll to inspect each hardware module in our air-gapped acoustic architecture."
        - Disabled mouse cursor direction tracking on the 3D model in `Hardware3DScene.tsx` to maintain a stable, commanding orientation with subtle floating breath.
        - Dynamic 3D component highlighting synchronized with staircase scrolling (`activePartKey`):
          - Module 01 (ESP32-S3 Dual-Core SoC) -> `esp32` elevates smoothly +0.35 units with glowing emerald beacon and targeted spotlight.
          - Module 02 (INMP441 I2S Digital Microphone) -> `inmp441_microphone` elevates with beacon.
          - Module 03 (Tactile Confirmation Switches) -> `approve_button` & `decline_button` elevate with beacon.
          - Module 04 (MAX98357A I2S Class-D Amplifier / Piezo Speaker) -> `piezo_speaker` elevates with beacon.
          - Module 05 (SSD1306 128x64 OLED Display) -> `oled` elevates with beacon.
        - Wired up the red Decline tactile push-button in `Hardware3DModel.ts` with metallic through-hole breadboard legs, GPIO 19 jumper wire, and GND return wire.
        - Bi-directional navigation: clicking any staircase node or clicking any 3D component automatically selects and transitions that step into view via `scrollToStep`.
      - FAQs Section (interactive animated accordion covering acoustic replay prevention, gasless economics, background noise resilience, USB serial communication, and fail-closed key security).
      - Architectural Footer (fanned card stack logo, multi-column navigation matrix, transformed cursive `MelodyPayStaffRibbon` wave rendered in pure glowing white Spencerian calligraphy matching `PayForSoundStaffRibbon` identically with tight, cohesive kerning, centered word proportion flanked by serene undulating stave trails, floating notes, live system status telemetry, slowed calm animation tempo ~15s per cycle, and the brightened, visible hero panorama background image `/image copy 3.png` at 70% opacity with deep green base `#0d281a` and gentle gradient wash creating a cohesive thematic visual bookend with the hero).
  - [x] 33/33 unit tests passing and clean Vite HMR verified.
- [ ] Task 9: Integrate ENSv2 Merchant Resolution (`receiver-web/src/core/ensv2.ts`, `cli/src/ens.ts`, `tests/ensv2-resolution.test.ts`).
- [ ] Task 10: Integrate Ledger Signer Backend (`cli/src/signers/ledger.ts`, `tests/ledger-signer.test.ts`).
