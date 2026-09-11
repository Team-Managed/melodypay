# Firmware Security Boundary

The current firmware tree is a hardware and protocol scaffold. It is not safe for real funds.

The current `keystore.c` uses ESP32-S3 NVS and `esp_fill_random()` only to exercise first-boot persistence and the state machine. `keystore_sign_digest()` deliberately returns `ESP_ERR_NOT_SUPPORTED`; it must not be replaced with an unreviewed software signer.

Before a production build:

1. Add a validated secure element with Ethereum `secp256k1` key generation and signing.
2. Provision the secure element during manufacturing and never export its private key.
3. Implement and test Keccak-256, EIP-1559 RLP, RFC 6979, and signature recovery parity through the selected crypto library.
4. Disable `CONFIG_MELODY_DEV_KEY_BACKEND`.
5. Enable secure boot and flash encryption through a documented provisioning process.
6. Run `idf.py build`, unit tests, hardware-in-the-loop audio tests, and an independent security review.

Never fund the development backend with real assets.
