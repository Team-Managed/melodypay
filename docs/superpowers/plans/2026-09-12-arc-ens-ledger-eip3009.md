# Arc ENSv2 Ledger EIP-3009 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Arc USDC EIP-3009 payments, ENSv2 merchant subnames, Ledger signer compatibility, and a real ENSv2 registrar contract while preserving MelodyPay's keyless receiver and hardware approval boundaries.

**Architecture:** `receiver-web/` and `cli/` create and submit payment authorizations. `esp32/` or Ledger signs typed data after user/device approval. `contracts/` contains only the ENSv2 merchant registrar and its tests/deploy scripts. The receiver never owns the payer key.

**Tech Stack:** TypeScript, React, ethers v6, Node TUI, ESP-IDF 5.5+, Solidity 0.8.20+, Foundry, ENSv2 Sepolia, Arc Testnet, Arc USDC, Ledger DMK/Ethereum signer.

## Global Constraints

- Arc Testnet chain ID: `5042002`.
- Arc Testnet USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`.
- Arc USDC ERC-20 amount precision: 6 decimals.
- Arc native gas precision: 18 decimals.
- Use canonical EIP-3009 EIP-712 signing with USDC name `USDC` and version `2` verified from Arc Testnet.
- Use `receiveWithAuthorization`, not `transferWithAuthorization`, for merchant submission.
- Do not copy NONET's `EIPThreeDoubleZeroNine.sol` custom personal-sign implementation.
- Do not add arbitrary calldata to the hardware wallet.
- Do not persist payer private keys in web or receiver CLI.
- ENSv2 deployment target is Sepolia only.
- Ledger is an optional signer backend, not a dependency of the ESP32 core path.
- The ENSv2 registrar is testnet-only and must not custody customer payment funds.

## File Map

- Create `contracts/foundry.toml`, `contracts/src/MelodyPaySubnameRegistrar.sol`, `contracts/test/`, and `contracts/script/`.
- Modify `receiver-web/src/core/chains.ts` and `receiver-web/src/core/tokens.ts` for Arc/USDC metadata.
- Create `receiver-web/src/core/eip3009.ts` for typed-data construction and authorization validation.
- Modify `receiver-web/src/core/payment-protocol.ts` for a typed authorization message.
- Modify `receiver-web/src/pages/ReceivePayment.tsx` for ENS names and Arc USDC mode.
- Create `cli/src/signers/ledger.ts`, `cli/src/ens.ts`, and `cli/src/commands/`.
- Modify `cli/src/index.ts` to expose payment, merchant profile, Ledger, and diagnostics commands.
- Create `esp32/components/eip3009/` for typed-data field encoding and signing boundary.
- Modify `esp32/components/evm/` and `esp32/components/protocol/` for authorization payloads.
- Create `docs/sponsor-integrations.md`, `docs/continuity-disclosure.md`, and evidence checklists.

### Task 1: Create the Foundry Contract Workspace

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/src/MelodyPaySubnameRegistrar.sol`
- Create: `contracts/test/MelodyPaySubnameRegistrar.t.sol`
- Create: `contracts/script/DeployRegistrar.s.sol`
- Modify: `contracts/README.md`

- [ ] Pin Solidity `0.8.20` and install ENSv2 contracts using the ENS repository dependency described by the official tutorial.
- [ ] Define immutable registry, payment token, beneficiary, annual price, and minimum duration.
- [ ] Implement `isAvailable`, `getPrice`, `register`, and `renew`.
- [ ] Use `SafeERC20` for the testnet registration fee.
- [ ] Call ENSv2 `PermissionedRegistry.register()` with an explicit role bitmap.
- [ ] Emit `NameRegistered` and `NameRenewed` events containing label, owner, duration, expiry, and price.
- [ ] Write Foundry tests for availability, role authorization, registration payment, renewal, invalid owner, and unavailable labels.
- [ ] Deploy only to Sepolia after local tests pass; record registry, resolver, registrar, MockUSDC, and merchant name in deployment output.

### Task 2: Add Arc Network and USDC Profiles

**Files:**
- Modify: `receiver-web/src/core/chains.ts`
- Modify: `receiver-web/src/core/tokens.ts`
- Modify: `cli/src/chains.ts`
- Test: `tests/arc-config.test.ts`

- [ ] Add Arc Testnet with chain ID `5042002`, RPC `https://rpc.testnet.arc.io`, and explorer `https://testnet.arcscan.app`.
- [ ] Add Arc USDC at `0x3600000000000000000000000000000000000000` with 6 ERC-20 decimals.
- [ ] Keep Arc native gas display separate from ERC-20 USDC amount formatting.
- [ ] Add tests that reject the old Arc/USDC address if it differs from the current official docs and accept only the verified address.
- [ ] Add an Arc faucet/testnet setup section without committing secrets.

### Task 3: Implement Canonical EIP-3009 Typed Data

**Files:**
- Create: `receiver-web/src/core/eip3009.ts`
- Create: `tests/eip3009.test.ts`
- Modify: `receiver-web/src/core/payment-protocol.ts`

- [ ] Define the exact EIP-712 domain `{ name: "USDC", version: "2", chainId: 5042002, verifyingContract: ARC_USDC }`.
- [ ] Define `ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)`.
- [ ] Generate a cryptographically random 32-byte nonce.
- [ ] Use `validAfter = 0` and a bounded `validBefore` derived from the receiver TTL.
- [ ] Expose `buildReceiveAuthorizationTypedData()` returning domain, types, primary type, and message.
- [ ] Expose `splitAuthorizationSignature()` for `v/r/s` and preserve the full `bytes` signature form.
- [ ] Verify the digest and recovered address against a known ethers test vector.
- [ ] Test that changing chain ID, verifying contract, recipient, amount, or nonce changes the digest.

### Task 4: Add Arc EIP-3009 Receiver Flow

**Files:**
- Modify: `receiver-web/src/pages/ReceivePayment.tsx`
- Modify: `receiver-web/src/core/tx-builder.ts`
- Modify: `cli/src/receiver.ts`
- Create: `tests/arc-receiver-flow.test.ts`

- [ ] Add payment mode selection: native EVM transfer or Arc USDC authorization.
- [ ] For Arc USDC, fetch sender balance, token decimals, and Arc gas fee context without confusing 6-decimal token units with 18-decimal gas units.
- [ ] Send an authorization request containing Arc chain ID, USDC contract, recipient, amount, valid-before, and random nonce.
- [ ] Receive the signed EIP-712 authorization through the existing sound transport boundary.
- [ ] Verify recovered signer, recipient, amount, expiry, authorization nonce state, and token contract before broadcast.
- [ ] Submit `receiveWithAuthorization` with the receiver as caller.
- [ ] Wait for `AuthorizationUsed` and `Transfer` receipt evidence.
- [ ] Return the ArcScan transaction link to the web and CLI operator.
- [ ] Reject stale, expired, duplicate, malformed, or wrong-domain authorizations.

### Task 5: Add ESP32 EIP-3009 Signing Boundary

**Files:**
- Create: `esp32/components/eip3009/CMakeLists.txt`
- Create: `esp32/components/eip3009/include/eip3009.h`
- Create: `esp32/components/eip3009/eip3009.c`
- Modify: `esp32/components/evm/evm_tx.c`
- Modify: `esp32/components/protocol/protocol.c`
- Test: `esp32/components/eip3009/test_eip3009.c`

- [ ] Add a distinct authorization message type; do not serialize it as an EIP-1559 transaction.
- [ ] Decode Arc chain ID, USDC contract, recipient, amount, valid-before, and nonce into bounded fields.
- [ ] Display `Arc / USDC / recipient / amount / expiry` before approval.
- [ ] Compute the EIP-712 digest using verified domain/type hashes.
- [ ] Require the existing physical approval hold before signing.
- [ ] Route digest signing through the secure-element interface; keep development signing fail-closed until a reviewed secp256k1 backend exists.
- [ ] Add golden digest vectors shared with the TypeScript tests.
- [ ] Wipe authorization and signature buffers after transmission.

### Task 6: Integrate ENSv2 Merchant Resolution

**Files:**
- Create: `receiver-web/src/core/ensv2.ts`
- Create: `cli/src/ens.ts`
- Modify: `receiver-web/src/pages/ReceivePayment.tsx`
- Modify: `cli/src/commands/merchant.ts`
- Test: `tests/ensv2-resolution.test.ts`

- [ ] Resolve normalized ENSv2 names on Sepolia using an ENSv2-ready library and the canonical Universal Resolver path.
- [ ] Verify forward resolution and reject empty or mismatched results.
- [ ] Read payment profile records for Arc chain, USDC token, and merchant address.
- [ ] Display the ENS name and complete resolved address on the receiver confirmation screen.
- [ ] Add CLI commands to resolve and inspect a merchant profile.
- [ ] Add a profile-update path that is protected by Ledger when used from the CLI.
- [ ] Test resolution failures, missing records, address mismatch, and stale resolver handling.

### Task 7: Integrate Ledger Signer Compatibility

**Files:**
- Create: `cli/src/signers/ledger.ts`
- Create: `cli/src/signers/types.ts`
- Modify: `cli/src/index.ts`
- Create: `cli/test/ledger-signer.test.ts`

- [ ] Add Ledger Device Management Kit and Ethereum signer dependencies following Ledger's current signer documentation.
- [ ] Define `SignerBackend.signTypedData()` and `SignerBackend.signTransaction()` interfaces.
- [ ] Implement a Ledger backend that requires device clear-signing confirmation.
- [ ] Add TUI actions to discover a Ledger, select an account, preview domain/message, sign, and disconnect.
- [ ] Keep the receiver broadcast path keyless; Ledger is only a payer/operator signer backend.
- [ ] Add a mocked transport test for request formatting and a physical-device acceptance test for clear signing.
- [ ] Capture Ledger documentation feedback required by the sponsor track.

### Task 8: Arc/ENS/Ledger End-to-End Testnet Demo

**Files:**
- Create: `docs/arc-ens-ledger-demo.md`
- Modify: `docs/demo-script.md`
- Modify: `docs/architecture.md`

- [ ] Register a merchant ENSv2 subname on Sepolia with the registrar contract.
- [ ] Set and read resolver records for Arc Testnet, USDC, and merchant recipient.
- [ ] Create an Arc USDC authorization from the receiver.
- [ ] Sign it with ESP32 once the production signer backend exists; use Ledger as the alternate demonstrable signer.
- [ ] Submit `receiveWithAuthorization` and verify `AuthorizationUsed` and `Transfer` events.
- [ ] Record ArcScan, ENS Explorer, registrar, and Ledger evidence links.
- [ ] Demonstrate rejection of a modified recipient and expired authorization.

### Task 9: Finalist Submission Evidence

**Files:**
- Create: `docs/continuity-disclosure.md`
- Create: `docs/sponsor-integrations.md`
- Modify: `README.md`

- [ ] Separate pre-existing PWA work from hackathon-period hardware, Arc, ENSv2, Ledger, and contract work.
- [ ] Link exact source files, deployed contracts, testnet transactions, and demo timestamps.
- [ ] Document that the custom Solidity registrar exists for ENSv2 merchant identity and directly supports the merchant-resolution flow.
- [ ] Include architecture diagram, setup commands, test commands, and hardware security limitations.
- [ ] Prepare separate sponsor-specific demo segments within the required video durations.
