# Firmware Security Boundary

The current firmware includes a software development signer. It is not safe for real funds.

`keystore.c` uses an NVS development key and mbedTLS secp256k1 signing. The
signer is enabled only after fixed Keccak, EIP-1559 serialization,
deterministic-signature, and recovery-parity self-tests pass.

Before a production build:

1. Add a validated secure element with Ethereum `secp256k1` key generation and signing.
2. Provision the secure element during manufacturing and never export its private key.
3. Implement and test Keccak-256, EIP-1559 RLP, RFC 6979, and signature recovery parity through the selected crypto library.
4. Disable `CONFIG_MELODY_DEV_KEY_BACKEND`.
5. Enable secure boot and flash encryption through a documented provisioning process.
6. Run `idf.py build`, unit tests, hardware-in-the-loop audio tests, and an independent security review.

Never fund the development backend with real assets.
# Secure Build Boundary

The current signing implementation is a software development backend using a
development key stored in NVS. NVS is not production key custody, and this
firmware makes no production-security claim.

Mainnet remains rejected unless both `CONFIG_MELODY_ENABLE_MAINNET=y` and the
runtime `allow_mainnet: true` opt-in are enabled. Testnet signing remains
subject to crypto initialization, self-tests, validation, and physical approval.

Private key material never leaves the keystore boundary and is not included in
transaction objects or API responses.
