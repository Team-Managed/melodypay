# MelodyPay Hardware Wallet Security Model

## Trust Boundaries

- The hardware wallet owns the signing key and is the only component allowed to approve a signature.
- The receiver is online, untrusted, and may provide malicious chain, recipient, amount, fee, nonce, or audio data.
- ggwave is transport only. It provides no identity or authorization by itself.
- The OLED and physical buttons are the user-verification boundary.
- The future secure element must own production key generation and ECDSA signing.

## Receiver Attack Cases

The device must reject or visibly warn on:

- Unsupported chain IDs
- Wrong recipient or token contract
- Amount or fee mismatch
- Expired requests
- Stale or duplicate nonce
- Excessive gas limit
- Arbitrary calldata
- Malformed or replayed audio frames
- A signature requested without physical approval

The current receiver validates native EIP-1559 transfers before broadcast and never reads a sender private key. Its legacy `PAY` message remains only for bench compatibility on Monad; `PAY2` carries chain and fee fields for the hardware migration.

## Prototype Limitations

- ESP32 NVS development key backend is not production custody.
- OLED driver is not yet connected in firmware.
- secp256k1 signing is fail-closed until a reviewed crypto library or secure element is integrated.
- Secure boot and flash encryption are not provisioned by this repository.
- Audio behavior requires physical speaker/microphone tests.

## Production Exit Criteria

1. Secure element generates and signs secp256k1 keys without export.
2. Firmware image is protected by secure boot and flash encryption.
3. EIP-1559 transaction encoding and signature recovery pass independent test vectors.
4. Device display shows complete recipient, chain, amount, and fee before approval.
5. Fuzz tests cover protocol parsers and transaction validation.
6. A hardware security review is complete before mainnet use.
