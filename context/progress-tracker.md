# MelodyPay Progress Tracker

## Current Phase
- **Phase**: Smart Contract Implementation for ENS Merchant Subname Registrar (Sepolia) & Arc Canonical USDC Settlement Integration.
- **Active Branch**: `feat/smart-contracts-implementation` (base: `origin/main` at `3ccfb70`).

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
- [ ] Sequential git commits via `/git-commit`.
