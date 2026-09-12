# MelodyPay ESP32-S3 Firmware

This is the ESP-IDF firmware scaffold for the offline sound wallet.

## Toolchain

- ESP-IDF 5.2 or newer
- ESP32-S3 target
- USB data cable and the photographed N16R8 development board

```bash
idf.py set-target esp32s3
idf.py build
idf.py flash monitor
```

The pin assignments are centralized in `main/hardware.h` and match `docs/hardware-wiring.md`.

## Hardware Bring-up

The firmware now initializes the microphone and amplifier I2S channels on every boot. Connect the assembled modules, verify the rails with a multimeter, then build and flash:

```bash
idf.py set-target esp32s3
idf.py -p COM_PORT flash monitor
```

The OLED driver remains serial-only. The development NVS signer is enabled only
after its Keccak, RLP, deterministic ECDSA, and recovery self-tests pass.

## Current Boundary

The firmware supports native EIP-1559 signing for the compiled chain policy and
requires GPIO10 approval before returning a raw transaction. It remains a
development demo and must not be funded with real assets.

The wallet crypto path is development-only: the private key is retained in
NVS and is not suitable for real funds. Mainnet requires both the build-time
`CONFIG_MELODY_ENABLE_MAINNET` gate and a persisted runtime opt-in. The default
build enables Monad testnet and Ethereum Sepolia; production chains require a
mainnet-enabled build and explicit runtime opt-in.
