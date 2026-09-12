# ESP32 Software Crypto Boundary Design

## Goal

Add a reviewed, testable software-crypto boundary for the ESP32 EVM component without presenting the development NVS backend as production-secure.

## Scope

- Use ESP-IDF mbedTLS secp256k1 with deterministic ECDSA (RFC 6979).
- Implement Ethereum Keccak-256 with legacy Keccak padding, not SHA3 padding.
- Derive an uncompressed secp256k1 public key and Ethereum address without exporting the private key.
- Encode and sign native EIP-1559 type-2 transactions using canonical RLP.
- Produce the correct ECDSA recovery `yParity`, including low-`s` normalization.
- Preserve the existing NVS development key as an internal keystore value.
- Add firmware self-tests with fixed vectors and expose them through the firmware console/JSON API.
- Keep mainnet disabled unless both `CONFIG_MELODY_ENABLE_MAINNET=y` and an explicit NVS runtime opt-in are present.
- Preserve fail-closed behavior when NVS or crypto initialization/self-test fails.

The CLI and all ggwave transport code are out of scope.

## Boundary

The `evm` component owns Keccak, transaction validation, RLP, signing-payload construction, and signed type-2 serialization. It receives a registered signer callback; it never reads NVS and never sees a private key.

The `keystore` module owns the NVS development key, mbedTLS key setup, deterministic ECDSA, public-key derivation, address derivation, signature recovery parity, and secure cleanup. It exposes only digest signing, address derivation, initialization status, and a public self-test result.

The firmware API owns JSON parsing, runtime chain opt-in persistence, visible warnings, approval flow integration, and response formatting. It passes transaction fields to `evm` and never handles private-key bytes.

## Transaction Format

The unsigned signing payload is:

```text
0x02 || RLP(chainId, nonce, maxPriorityFeePerGas, maxFeePerGas,
            gasLimit, to, value, data)
```

The signed transaction is:

```text
0x02 || RLP(chainId, nonce, maxPriorityFeePerGas, maxFeePerGas,
            gasLimit, to, value, data, yParity, r, s)
```

Only native transfers with empty data and a 20-byte recipient are supported. Integer fields are supplied as fixed-width binary values internally and serialized with leading zeroes removed; zero is encoded as the empty RLP byte string. `maxFeePerGas` must be at least `maxPriorityFeePerGas`.

## Chain Safety

Monad testnet remains enabled by default. Mainnet policy entries exist only behind `CONFIG_MELODY_ENABLE_MAINNET`, which defaults to `n`.

Runtime mainnet opt-in is stored in the `wallet` NVS namespace under a dedicated boolean key and can only be set through `wallet.configure` with `allow_mainnet: true`. The operation logs a warning and returns a warning field. Mainnet configuration and signing reject with `ESP_ERR_NOT_ALLOWED` unless both the build flag and persisted runtime flag are true. The default path never sets this flag.

## Failure Handling

- `keystore_init()` fails if NVS access, key size/validity, secp256k1 setup, or the crypto self-test fails.
- The private key is never returned by an API, copied into a transaction object, or serialized.
- Signing rejects before output if the signer is not initialized, the chain is not allowed, the runtime mainnet gate is absent, validation fails, or the output buffer is too small.
- All temporary mbedTLS objects and private-key buffers are cleared before return.
- No unsigned or pseudo-signed bytes are emitted on any failure path.

## Verification

The firmware self-test covers:

1. Keccak-256 of the empty string and `abc`.
2. Private key `1` public key and Ethereum address.
3. Deterministic signature repeatability, low-`s`, and recovery against the derived public key.
4. A complete type-2 golden transaction and its signing payload.
5. Mainnet compile/runtime gate behavior and uninitialized signer rejection.

Run the root TypeScript tests/build and `idf.py build` with the installed ESP-IDF 5.5.5 toolchain. Hardware flashing and physical self-test execution are not claimed unless a device is connected.
