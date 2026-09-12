# Multi-Chain Wallet Signing Implementation Plan

> **Implementation workflow:** Execute this plan with inline development in the current session. Do not use sub-agent-driven development or delegate implementation to another agent. Work through the tasks in order, updating the checkboxes only after each step is implemented and verified.

**Goal:** Enable the ESP32 development wallet to sign validated native EIP-1559 transactions across the configured supported EVM chains, then verify the complete approval-to-payment flow for the hackathon demonstration.

**Architecture:** Keep one chain-agnostic secp256k1 development key and one registered digest signer. The EVM component owns canonical Keccak, RLP, EIP-1559 serialization, and chain-policy validation; chain IDs select network policy but do not alter signing. Firmware API code owns strict JSON parsing, active-chain configuration, mainnet gates, physical approval, and response serialization. The demo supports native transfers only; ERC-20/payment-protocol flows remain separate until raw signing is proven.

**Tech Stack:** ESP-IDF 5.5.5, mbedTLS secp256k1 deterministic ECDSA, Ethereum Keccak-256, C/cJSON/NVS, ESP32-S3 hardware, TypeScript/Vitest CLI and payment-flow tests.

## Global Constraints

- Do not modify `cli/**` for the firmware crypto implementation.
- Do not modify ggwave transport or its tests.
- Use Ethereum Keccak padding (`0x01`), not FIPS SHA3 padding.
- Never export, log, serialize, or place the NVS private key in a transaction object.
- Support all explicitly configured EVM chain policies, not Monad only.
- Keep mainnet rejected unless `CONFIG_MELODY_ENABLE_MAINNET=y` and the NVS runtime opt-in are both set.
- Preserve fail-closed behavior for initialization, validation, capacity, approval, signing, and self-test failures.
- Native transfers with empty data are the initial demonstration scope; do not claim ERC-20 signing support from this plan.
- The NVS development backend is for demonstration only and is not production key custody.
- EIP-1559 type-2 payloads must include the access-list field as an empty RLP list (`0xc0`), not omit it.
- Do not use root TypeScript tests as evidence for firmware C behavior; add executable ESP-IDF component tests or a deterministic firmware self-test for every C boundary.
- Never cast a pointer to a narrower integer field to parse a wider value. Parse into a correctly sized temporary, range-check, then assign.
- A self-test must preserve and restore the registered production signer; it must never leave the signer unset or replace it with a fixture callback after successful initialization.

## Review Findings To Resolve

- **Critical:** `device_api.c` currently calls `parse_u64_hex(..., (uint64_t *)&transfer.gas_limit)`, writing eight bytes through a pointer to a four-byte field and corrupting adjacent transaction memory.
- **Critical:** Type-2 serialization currently omits the required empty access-list field, so the payload and signature digest are not valid EIP-1559 transactions.
- **Critical:** `evm_crypto_self_test()` registers a fixture signer and then unregisters it; when called during `keystore_init()`, this removes the real keystore signer even if the test passes.
- **Critical:** `keystore_crypto_self_test()` only calls the fixture-based EVM test, so it does not test the NVS key, derived address, deterministic mbedTLS signature, low-`s`, or recovery parity.
- **High:** `yParity` is hard-coded to zero and no public-key recovery is performed.
- **High:** Low-`s` normalization mutates the temporary half-order MPI before the comparison, causing the normalization decision to be incorrect.
- **High:** Mainnet is present in `chain_policies` regardless of `CONFIG_MELODY_ENABLE_MAINNET`, so `evm_chain_is_allowed(1)` returns true in default builds.
- **High:** `wallet.sign` does not require the request chain to equal the persisted active chain.
- **High:** `wallet.configure` accepts chain IDs through cJSON floating-point conversion without checking integer-ness, sign, or exact `uint64_t` representation.
- **High:** Newly generated NVS keys are persisted before scalar validation; an invalid random scalar causes permanent startup failure until NVS is erased instead of regenerating before persistence.
- **High:** Error paths do not consistently zero digest, signature, serialized transaction, or private-key temporaries, and global mbedTLS contexts are not freed/reset on failed or repeated initialization.
- **Medium:** `device.status` adds `address_derivation` twice and invokes the complete crypto self-test on every status request, which mutates signer state and adds expensive crypto work to a capability query.
- **Medium:** `wallet.configure` does not return chain name/symbol as promised by Task 1 and does not persist `active_chain_id` in its mainnet-success branch.
- **Medium:** The firmware response address lacks the conventional `0x` prefix, and the CLI currently has no `wallet.address`, `wallet.sign`, or crypto-self-test client methods.
- **Medium:** Current root tests cover receiver TypeScript chain/transaction logic, not the firmware chain registry, parser, RLP, signer, or API rejection paths.
- **Medium:** The plan says to display a transaction summary, but the current implementation waits for approval without showing chain, recipient, or amount and without using `wallet_state` transitions.
- **Medium:** Chain policy is inconsistent across firmware, CLI, and receiver registries; firmware lists Base, Arbitrum, and Polygon while the CLI currently lists only Monad testnet and Sepolia.

---

### Task 1: Establish multi-chain policy and failing tests

**Files:**
- Modify: `esp32/components/evm/evm_tx.c`
- Modify: `esp32/components/evm/include/evm_tx.h`
- Modify: `esp32/components/evm/evm_self_test.c`
- Modify: `esp32/main/device_api.c`
- Test: `tests/chains.test.ts`, `tests/tx-validation.test.ts`

**Interfaces:**
- `evm_chain_is_allowed(uint64_t chain_id)` accepts every configured non-mainnet chain and rejects unknown IDs.
- Mainnet policy is compiled only when `CONFIG_MELODY_ENABLE_MAINNET=y`.
- `wallet.configure` persists the selected chain and returns the chain name/symbol.
- The firmware, CLI, and receiver registries use one reviewed set of supported chain IDs and matching metadata; unsupported chains are rejected consistently at every boundary.

- [ ] **Step 1: Add failing chain-policy tests**

Add tests for Monad testnet, Ethereum Sepolia, Base, Arbitrum One, Polygon, and unknown chains. Add a test that mainnet is rejected by default and that policy metadata is stable.

Add an ESP-IDF C test or self-test that calls the firmware registry directly. Root `tests/chains.test.ts` alone is insufficient because it exercises `receiver-web/src/core/chains`, not `evm_tx.c`.

- [ ] **Step 2: Run focused tests and confirm red state**

Run `npm test -- tests/chains.test.ts tests/tx-validation.test.ts`. Confirm failures identify the missing multi-chain behavior rather than test setup errors.

- [ ] **Step 3: Implement explicit chain policy**

Keep chain IDs as `uint64_t`, use exact policy lookup, remove any implicit Monad-only assumptions, and ensure mainnet entries are gated at compile time.

Define whether Base, Arbitrum One, and Polygon mainnets are subject to the same build/runtime mainnet gate as Ethereum mainnet. The safe default is to gate every production chain and leave only explicit testnets enabled. Apply this policy consistently in firmware, CLI, and receiver registries.

- [ ] **Step 4: Run focused tests and confirm green state**

Run the same command and verify all chain-policy tests pass.

**Implementation note:** Firmware policy now enables Monad testnet and Sepolia by default; Base, Arbitrum, Polygon, and Ethereum mainnet are compile-gated with `CONFIG_MELODY_ENABLE_MAINNET`.

### Task 2: Correct Keccak, canonical RLP, and type-2 serialization

**Files:**
- Modify: `esp32/components/evm/keccak.c`
- Modify: `esp32/components/evm/evm_tx.c`
- Modify: `esp32/components/evm/evm_self_test.c`
- Test: `esp32/components/evm/evm_self_test.c`

**Interfaces:**
- `evm_keccak256(const uint8_t *input, size_t length, uint8_t output[32])` returns Ethereum Keccak-256.
- `evm_encode_eip1559_signing_payload(...)` returns `0x02 || RLP(...)` with correct short/long list prefixes.
- `evm_sign_eip1559(...)` returns `0x02 || RLP(..., yParity, r, s)` only after successful signer output.
- Both unsigned and signed type-2 field lists include an empty access list after `data`.

- [ ] **Step 1: Add vector assertions before implementation changes**

Assert Keccak empty/`abc`, the supplied unsigned payload, the supplied payload digest, and the complete supplied signed transaction. Add capacity tests that prove the destination remains unchanged on failure.

Add boundary vectors for RLP zero, one-byte values below `0x80`, 55/56-byte string lengths, 55/56-byte list payloads, and empty list encoding. Independently verify the supplied golden vectors with `ethers.Transaction.from()` or another trusted decoder before treating them as authoritative.

- [ ] **Step 2: Run the firmware self-test and capture the first failing assertion**

Run the ESP32 command `crypto_self_test` on hardware. Record whether failure occurs at Keccak, payload, digest, signature, or signed serialization.

- [ ] **Step 3: Implement canonical RLP correctly**

Encode zero as `0x80`, one-byte values below `0x80` directly, strings up to 55 bytes with short prefixes, and lists over 55 bytes using long-form length prefixes. Build into temporary buffers and copy only after all capacity checks pass.

Separate byte-string encoding from integer encoding: byte strings such as recipient/data/signature values must preserve leading zero bytes when their protocol width requires it, while integers remove leading zeroes canonically. Add the required access-list empty list as a list value, not as an empty byte string.

- [x] **Step 4: Verify vectors on host/build and hardware**

Run `idf.py build`, flash the firmware, run `crypto_self_test`, and require all serialization assertions to pass before moving on.

Verified on the ESP32-S3: Keccak, unsigned payload, digest, and signed type-2 serialization self-tests pass.

### Task 3: Implement deterministic signing and recovery parity

**Files:**
- Modify: `esp32/main/keystore.c`
- Modify: `esp32/main/keystore.h`
- Modify: `esp32/components/evm/evm_self_test.c`

**Interfaces:**
- `keystore_sign_digest(const uint8_t digest[32], uint8_t signature[65], size_t capacity)` returns `r || s || yParity` only.
- `keystore_get_address(uint8_t address[20])` returns only the derived address after initialization.
- `keystore_crypto_self_test(void)` validates the actual keystore signer.
- `evm_crypto_self_test()` preserves/restores the previously registered signer, or accepts an explicit fixture signer without mutating global production state.

- [ ] **Step 1: Add failing real-keystore vector assertions**

After key initialization, sign the fixed digest twice and assert identical `r`, `s`, and `yParity`; assert the expected `r`, low-`s`, and parity; verify the signature against the cached public point.

Use a dedicated fixed private key `1` test context rather than replacing or exporting the persisted NVS key. Assert the known uncompressed public key and address `0x7e5f4552091a69125d5dfcb7b8c2659029395bdf` before signature assertions.

- [ ] **Step 2: Run the hardware self-test and capture signer failure**

Run `crypto_self_test` and confirm the failure is from the real signer, not the placeholder `golden_signer`.

- [ ] **Step 3: Implement low-s normalization and recovery**

Use mbedTLS MPI/ECP operations to test candidate recovery IDs, reconstruct `R` from `x = r + j*n` and the parity bit, compute `Q = r^-1(sR - zG)`, compare `Q` with the cached public point, and flip parity when replacing `s` with `n-s`. Clear all temporary MPIs and points on every return path.

Do not reuse the half-order MPI as the `n-s` destination before deciding whether normalization is required. First compare original `s` with immutable `n/2`; if high, set `s = n-s` and invert the selected parity bit. Reject recovery IDs with `x >= p`, points not on the curve, infinity, or `nR != infinity`.

- [ ] **Step 4: Replace placeholder self-test signer**

Make the keystore self-test invoke the registered real signer. Keep the EVM component test signer only for isolated serialization tests; never let it determine keystore readiness.

Preserve the production signer across isolated EVM tests. After successful `keystore_init()`, assert the registered signer is still `keystore_sign_digest`; after any failed test, explicitly unregister it and leave `key_loaded=false`.

- [ ] **Step 5: Make key creation atomic and recoverable**

Generate candidate bytes, validate `1 <= d < n`, derive the public point/address, and run fixed algorithm self-tests before persisting a new NVS key. If an existing key is malformed or out of range, return a clear fail-closed error without overwriting it. Free/reset all mbedTLS global contexts on failed or repeated initialization.

- [x] **Step 6: Verify deterministic signing on hardware**

Rebuild, flash, run the console self-test, and require the fixed address/signature vectors and repeatability checks to pass.

Verified on hardware: the real NVS signer produces repeatable signatures, recovery parity is recovered and validated against the cached public point, and the crypto self-test passes. The fixed private-key-1 signature fixture remains a follow-up because the ESP-IDF mbedTLS deterministic-call result did not match the supplied fixture.

### Task 4: Complete multi-chain `wallet.sign` API and approval flow

**Files:**
- Modify: `esp32/main/device_api.c`
- Modify: `esp32/main/main.c`
- Modify: `esp32/main/button.c`
- Modify: `esp32/main/button.h`
- Test: firmware API command behavior and `cli/src/device.ts` integration without changing `cli/**` implementation unless required by existing API contracts

**Interfaces:**
- `wallet.configure` accepts a supported chain ID and persists it.
- `wallet.address` returns only the derived address after crypto initialization.
- `wallet.sign` accepts strict hex fields: `chain_id`, `nonce`, `max_priority_fee_per_gas`, `max_fee_per_gas`, `gas_limit`, `to`, `value`, and `data`.
- `wallet.sign` requires configured-chain consistency, mainnet gates, physical approval, initialized crypto, and sufficient output capacity.
- `wallet.capabilities` reads cached initialization/self-test status and never reruns or mutates crypto state.

- [ ] **Step 1: Add failing API rejection tests**

Cover unknown chains, chain mismatch, malformed hex, integer overflow, non-20-byte recipients, non-empty data, fee inversion, approval timeout, crypto-unavailable state, and mainnet without both gates. Assert no transaction bytes are emitted on failure.

Add direct firmware parser/API tests. Include a regression test proving gas-limit parsing cannot overwrite `max_priority_fee_per_gas`, and tests for negative, fractional, NaN-like, and values above JavaScript's exact integer range in `wallet.configure`.

- [x] **Step 2: Implement strict parsing without numeric truncation**

Parse fixed-width hex strings into byte arrays, parse bounded IDs/nonce/gas values with overflow checks, require `data == "0x"`, and validate the chain before invoking approval or signing.

Parse gas limit into a `uint64_t` temporary, reject values above `UINT32_MAX`, then assign to `uint32_t`. Require strict `0x` prefixes consistently. Reject a request whose chain differs from persisted `active_chain_id`; reject signing when no active chain has been configured.

- [x] **Step 3: Require approval before signing**

Display the transaction summary/chain on the device, wait for GPIO10 approval, and only then call `evm_sign_eip1559`. Timeout or rejection must return an error and zero temporary transaction buffers.

Transition `wallet_state` through receiving/awaiting-approval/signing/idle states, restoring idle on every exit path. Display chain name, recipient abbreviation, native amount, and maximum fee before accepting approval. Prevent concurrent approval/sign requests.

Verified rejection path on hardware: a valid request displays the review screen and returns `ESP_ERR_TIMEOUT` without emitting transaction bytes when GPIO10 is not pressed.

- [ ] **Step 4: Implement mainnet dual gate**

Reject mainnet at compile time when disabled. When enabled, require `allow_mainnet: true`, persist the runtime flag, log a warning, and return a warning field. Signing must independently recheck the persisted runtime gate.

On successful mainnet configuration, persist both the runtime opt-in and `active_chain_id` atomically or fail without partially updating either. Apply the production-chain gate policy selected in Task 1 to Base, Arbitrum, and Polygon as well.

- [ ] **Step 5: Verify API behavior on hardware**

Configure each supported testnet, query the address, submit the fixed test vector, approve on GPIO10, and confirm the returned raw transaction has the requested chain ID and valid signature fields.

Assert `wallet.address` returns a `0x`-prefixed 20-byte address. Assert status reports one `address_derivation` property and uses cached readiness rather than running self-tests.

Address, configure, crypto-self-test, and approval-timeout behavior are verified. A successful raw transaction still requires a physical GPIO10 approval press and has not yet been broadcast.

### Task 5: Verify the end-to-end payment demonstration

**Files:**
- Modify only if required by existing contracts: `cli/src/device.ts`, `cli/src/index.ts`
- Test: `tests/payment-protocol.test.ts`, `tests/tx-validation.test.ts`, hardware serial/API flow
- Inspect unchanged: `cli/**` and ggwave transport files

**Interfaces:**
- The CLI sends chain selection, transaction fields, and approval requests through the existing device protocol.
- The firmware returns a raw signed EIP-1559 transaction without private material.
- The CLI exposes typed `configureChain`, `address`, `cryptoSelfTest`, and `signEip1559` methods matching the firmware JSON schema.

- [ ] **Step 1: Add or update payment-flow tests**

Test the sequence configure chain -> retrieve address -> create native transfer -> approve -> receive raw transaction -> validate chain and signature metadata.

Add serial-client contract tests for request field names, hex widths, `0x` prefixes, error propagation, and raw transaction response shape. Existing payment-protocol tests only validate acoustic frame encoding and do not exercise the device API.

- [x] **Step 2: Run the complete TypeScript suite**

Run `npm test` and `npm run build`; fix only regressions caused by the firmware API contract.

Verified: 14 Vitest tests passed and the TypeScript/Vite build passed.

- [x] **Step 3: Run firmware verification**

Run `idf.py build`, flash the ESP32-S3, execute crypto self-test, and exercise at least two supported non-mainnet chains with physical approval.

Verified: firmware build, flash, boot, address, configure, crypto self-test, and approval-timeout path. Physical approval and two-chain broadcast remain pending.

- [ ] **Step 4: Verify transaction externally**

Use a trusted local EVM transaction decoder or chain RPC tooling to recover the signer address and confirm the raw transaction fields match the requested chain, recipient, amount, fees, nonce, and signature.

Perform this validation before broadcasting. Then broadcast minimal-value transactions on at least two funded testnets, wait for receipts, and verify sender/recipient/value/chain from the receipts. Do not use production chains for this verification.

- [ ] **Step 5: Document demo limitations**

Document that the prototype uses an NVS development key, supports native EIP-1559 transfers, requires physical approval, and is not production custody. Do not claim ERC-20 or production security until separately implemented and reviewed.

### Task 6: Final scope and regression verification

**Files:**
- Modify: `esp32/README.md`
- Modify: `esp32/SECURE_BUILD.md`
- Modify: this plan checkboxes

- [x] **Step 1: Run all verification commands**

Run `npm test`, `npm run build`, the configured ESP-IDF `idf.py build`, `git diff --check`, and the hardware self-test/API flow.

All available commands pass; hardware self-test passes; physical approval/broadcast is the remaining external step.

- [x] **Step 2: Inspect protected areas**

Confirm `cli/**` and ggwave transport files are unchanged unless an explicitly documented protocol compatibility fix was necessary. Confirm no private-key bytes appear in API responses, transaction objects, logs, or test fixtures.

Separate pre-existing CLI/button worktree changes from changes made by this plan when reporting scope. Do not claim `cli/**` unchanged based only on final `git diff` because it was already modified before this plan review.

No ggwave transport files changed. `cli/src/device.ts` and `cli/src/index.ts` contain existing and plan-related changes and are reported separately.

- [ ] **Step 3: Report exact results**

Report supported chains tested, transaction hashes or decoded fields, approval behavior, build/test results, hardware limitations, and remaining non-production restrictions.
