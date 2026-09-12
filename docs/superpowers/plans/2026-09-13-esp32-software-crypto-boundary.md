# ESP32 Software Crypto Boundary Implementation Plan

> **Implementation workflow:** Execute this plan with inline development in the current session. Do not use sub-agent-driven development or delegate implementation to another agent. Work through the tasks in order, updating the checkboxes only after each step is implemented and verified. Steps use checkbox (`- [ ]`) syntax for tracking.

## Inline Execution Rules

- The primary agent owns all repository exploration, edits, test runs, and verification.
- Keep the task order below because later layers depend on the earlier crypto and serialization boundaries.
- Before each implementation step, inspect the current code and any existing user changes in the target files; do not overwrite unrelated work.
- After each task, run the narrowest applicable firmware or repository checks and record blockers in the final report.
- Do not create worktrees, dispatch sub-agents, or use sub-agent-driven-development for this plan.

**Goal:** Add a fail-closed ESP-IDF mbedTLS/Keccak signing boundary for native EIP-1559 transactions while retaining the NVS development key internally.

**Architecture:** The EVM component owns Ethereum hashing, validation, RLP, and type-2 serialization and calls a registered digest signer. The keystore owns NVS key material and mbedTLS secp256k1 operations, returning only public address or `(r,s,yParity)` results. Firmware API code owns JSON conversion and the two-part mainnet gate.

**Tech Stack:** ESP-IDF 5.5.5, mbedTLS secp256k1/ECDSA deterministic signing, C, cJSON, NVS, ESP-IDF Unity/self-test command, existing Vitest suite.

## Global Constraints

- Do not modify `cli/**`.
- Do not modify ggwave transport or its tests.
- Use Ethereum Keccak padding, not FIPS SHA3 padding.
- Never export, log, serialize, or place the NVS private key in an EVM transaction object.
- Keep mainnet rejected unless `CONFIG_MELODY_ENABLE_MAINNET=y` and the NVS runtime opt-in are both set.
- Preserve fail-closed behavior for initialization, validation, capacity, signing, and self-test failures.
- Do not claim production security; the NVS development backend remains development-only.

---

### Task 1: Add the failing crypto/self-test boundary

**Inline checkpoint:** Implement and verify this task directly before moving to Task 2. Keep the self-test red until the required primitives are available; do not delegate the red-state setup or verification.

**Files:**
- Modify: `esp32/components/evm/include/evm_tx.h`
- Modify: `esp32/main/keystore.h`
- Modify: `esp32/main/device_api.c`
- Modify: `esp32/main/main.c`
- Test: `esp32/components/evm/evm_tx.c` self-test vectors and firmware command/API behavior

**Interfaces:**
- `evm_signer_fn`: receives a 32-byte digest and fills `r`, `s`, and `y_parity` without exposing a key.
- `evm_register_signer(evm_signer_fn signer)`: registers the internal signer callback.
- `keystore_sign_digest(const uint8_t digest[32], uint8_t signature[65], size_t capacity)`: returns `r || s || yParity` only.
- `keystore_get_address(uint8_t address[20])`: derives/copies only the address.
- `keystore_crypto_self_test(void)`: returns `ESP_OK` only when all fixed vectors pass.

- [ ] **Step 1: Add self-test assertions for missing functionality**

Add the fixed Keccak, public-key/address, deterministic-signature, and type-2 golden-vector assertions to the firmware self-test entry point before implementing the primitives. The command must report failure and return nonzero when the boundary is unavailable.

- [ ] **Step 2: Run the firmware self-test/build to verify the red state**

Run `idf.py build` from `esp32`. Expected: failure because the new interfaces/primitives are not yet implemented, or the self-test reports failure if the test harness is already linkable.

### Task 2: Implement Ethereum Keccak and canonical RLP

**Inline checkpoint:** Continue in the same working session. Review the Task 1 diff before editing, implement Keccak/RLP directly, and run the focused vectors before proceeding.

**Files:**
- Create: `esp32/components/evm/keccak.c`
- Create: `esp32/components/evm/keccak.h`
- Modify: `esp32/components/evm/evm_tx.c`
- Modify: `esp32/components/evm/CMakeLists.txt`

**Interfaces:**
- `void evm_keccak256(const uint8_t *input, size_t length, uint8_t output[32])`.
- Internal bounded RLP helpers for byte strings, uint64 values, 32-byte values, and list assembly.

- [ ] **Step 1: Implement the 1600-bit Keccak-f[1600] permutation**

Use the Ethereum Keccak-256 rate/capacity and domain suffix `0x01`; absorb full blocks and pad the final block with `0x01` and final `0x80`. Keep state words and rotation constants fixed-width and endian-explicit.

- [ ] **Step 2: Run the known Keccak vectors**

Verify empty input equals `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` and `abc` equals `4e03657aea45a94fc7d47ba826c8d667c0d1e6e33f1c6f3f2f5a1c9f3e3f0f9b`.

- [ ] **Step 3: Implement canonical bounded RLP**

Encode zero as an empty string, one-byte values below `0x80` directly, and all other strings/lists with canonical short/long length prefixes. Return explicit capacity errors and never write partial output as a successful result.

- [ ] **Step 4: Run `idf.py build` and the self-test**

Expected: Keccak/RLP self-tests pass while signing remains unavailable.

### Task 3: Implement the internal mbedTLS secp256k1 keystore

**Inline checkpoint:** Implement the keystore boundary directly after confirming Task 2 checks. Preserve all existing unrelated work in the ESP32 and CLI areas.

**Files:**
- Modify: `esp32/main/keystore.h`
- Modify: `esp32/main/keystore.c`
- Modify: `esp32/main/CMakeLists.txt`
- Modify: `esp32/main/Kconfig.projbuild`
- Modify: `esp32/sdkconfig.defaults`

**Interfaces:**
- `keystore_init()` initializes NVS, validates the 32-byte development key, loads secp256k1 parameters, derives the public point/address, and runs the self-test.
- `keystore_sign_digest()` returns exactly 65 bytes `(r,s,yParity)` and never returns private material.
- `keystore_get_address()` returns exactly 20 address bytes only after successful initialization.

- [ ] **Step 1: Enable and require the ESP-IDF mbedTLS options**

Require `CONFIG_MBEDTLS_ECP_C`, `CONFIG_MBEDTLS_ECDSA_C`, `CONFIG_MBEDTLS_ECP_DP_SECP256K1_ENABLED`, and `CONFIG_MBEDTLS_ECDSA_DETERMINISTIC` in the project configuration and add `mbedtls` as a component requirement.

- [ ] **Step 2: Derive the uncompressed public key and address**

Read the NVS key into the existing private buffer, reject zero or out-of-range scalars, calculate `Q=dG`, serialize `0x04 || X || Y`, hash `X || Y` with Ethereum Keccak, and retain only the final 20 bytes as the address cache.

- [ ] **Step 3: Implement deterministic signing and recovery parity**

Call `mbedtls_ecdsa_sign_det_ext()` with SHA-256 as the RFC-6979 internal nonce-generation hash over the already Keccak-hashed transaction digest. Serialize 32-byte `r` and `s`, normalize `s` to the lower half-order, and recover both candidate R points using mbedTLS MPI/ECP operations until the candidate public key equals the cached public point. Return `yParity` adjusted when low-`s` normalization flips the recovery branch.

- [ ] **Step 4: Secure cleanup and initialization failure**

Clear local key buffers and mbedTLS contexts on every return path. Set `key_loaded` only after all crypto initialization and self-tests pass; otherwise retain fail-closed state.

- [ ] **Step 5: Run the keystore vectors**

Run `idf.py build` and the firmware self-test. For private key `1`, the expected address is `7e5f4552091a69125d5dfcb7b8c2659029395bdf`. For the type-2 signing digest `b3169442a2a5c820b5fafa7368ecd9f66ba37c4692044f47263efb9f38076822`, expected `r` is `ae14ffeaca26e22f85a995b8646ca9a0d156dcd4ec3ad831773f17d09fca4e2a`, expected low-`s` is `7e3318e0a571b54edce2bbec7498d97eec98c0e24cb3efc8af1f73a9c47ba85c`, and expected `yParity` is `0`. Repeated signatures must be identical.

### Task 4: Implement type-2 signing and API safety gates

**Inline checkpoint:** Integrate signing and API gates in place, then run focused rejection and golden-vector checks. No implementation work is to be split across sub-agents.

**Files:**
- Modify: `esp32/components/evm/include/evm_tx.h`
- Modify: `esp32/components/evm/evm_tx.c`
- Modify: `esp32/main/device_api.c`
- Modify: `esp32/main/main.c`

**Interfaces:**
- `evm_sign_eip1559()` returns a complete `0x02`-prefixed signed transaction.
- `wallet.address` returns an address only after crypto initialization.
- `wallet.sign` accepts hex transaction fields and returns a signed transaction only after approval and both chain gates pass.
- `wallet.crypto_self_test` and `crypto_self_test` run the same fixed-vector checks.

- [ ] **Step 1: Add the mainnet build/runtime gate test**

Exercise `wallet.configure` with mainnet while the build gate is disabled and confirm rejection. When enabled, require `allow_mainnet: true`, persist it in NVS, log a warning, and return a warning field. Reject signing if either gate is absent.

- [ ] **Step 2: Add strict transaction parsing and validation**

Parse fixed-width hex strings without integer truncation, require 20-byte recipient and empty data, enforce fee ordering and gas bounds, and reject invalid/unknown chains before invoking the signer.

- [ ] **Step 3: Build the unsigned payload, hash it, sign, and RLP-encode**

Construct exactly the EIP-1559 signing list, Keccak hash it, invoke the registered signer, then construct the nine-field signed list. Check output capacity before committing the response.

For the fixed vector with key `1`, chain `10143`, nonce `7`, recipient `0x1111111111111111111111111111111111111111`, value `10000000000000000`, gas limit `21000`, priority fee `2000000000`, max fee `150000000000`, and empty data, the unsigned payload is `02f182279f0784773594008522ecb25c00825208941111111111111111111111111111111111111111872386f26fc1000080c0`, and the signed transaction is `02f87482279f0784773594008522ecb25c00825208941111111111111111111111111111111111111111872386f26fc1000080c001a0ae14ffeaca26e22f85a995b8646ca9a0d156dcd4ec3ad831773f17d09fca4e2aa07e3318e0a571b54edce2bbec7498d97eec98c0e24cb3efc8af1f73a9c47ba85c`.

- [ ] **Step 4: Require approval before wallet signing**

Use the existing approval button path for `wallet.sign`; timeout, invalid state, and crypto errors return errors and never emit transaction bytes.

- [ ] **Step 5: Run API and firmware checks**

Run the firmware self-test command/API and `idf.py build`. Expected: safe rejection for unavailable crypto, mainnet without both gates, invalid fields, and approval timeout; valid testnet vectors produce the golden transaction.

### Task 5: Documentation and final verification

**Inline checkpoint:** Perform the final documentation, diff inspection, and test/build verification personally in this session. Report unavailable hardware validation explicitly.

**Files:**
- Modify: `esp32/SECURE_BUILD.md`
- Modify: `esp32/README.md`
- Test: repository TypeScript tests/build and ESP-IDF build

- [ ] **Step 1: Document the non-production boundary**

State that this is a software development backend, NVS is not production key custody, mainnet requires two explicit gates, and no production-security claim is made.

- [ ] **Step 2: Run repository verification**

Run `npm test`, `npm run build`, and `idf.py build`. Also run `git diff --check` and inspect that `cli/**` and ggwave transport files are unchanged.

- [ ] **Step 3: Report exact results and blockers**

Report changed files, test/build output, unavailable hardware validation, and any remaining limitation without claiming production readiness.
