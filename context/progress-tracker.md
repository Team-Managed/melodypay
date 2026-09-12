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
    - Beautiful, 100% recognizable cursive script typography for "Pay with sound" rendered in luminous white with soft drop-shadow.
    - Three distinct, parallel undulating musical stave lines with a traveling acoustic wave pulse, glowing light pearl, and floating musical notes.
    - Completely removed all floating pill badges (the `EVM LIVE` badge in the navbar and the `AIR-GAPPED ACOUSTIC WIRE` badge over the hero image) and removed the header logo icon for clean, minimal typography.
    - Hero copy updated to be short and crisp: "Sound waves as an air-gapped financial wire. Offline hardware signs transactions with physical button confirmation, settled instantly on-chain via keyless terminals."
    - Refined headline scale to a crisp editorial hierarchy (`text-2xl sm:text-3xl lg:text-4xl xl:text-[2.75rem]`).
  - [x] 32/32 unit tests passing and clean Vite HMR verified.
- [ ] Task 9: Integrate ENSv2 Merchant Resolution (`receiver-web/src/core/ensv2.ts`, `cli/src/ens.ts`, `tests/ensv2-resolution.test.ts`).
- [ ] Task 10: Integrate Ledger Signer Backend (`cli/src/signers/ledger.ts`, `tests/ledger-signer.test.ts`).
