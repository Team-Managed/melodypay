# MelodyPay Hardware Wallet Architecture

```text
                         sound: payment request
Online receiver  ------------------------------------>  ESP32-S3 wallet
  - recipient address                                      - INMP441 mic
  - chain and RPC                                          - OLED review
  - nonce and fee data                                      - Physical approval (production; deferred in bench mode)
  - no sender private key                                   - local signing

Online receiver  <------------------------------------  ESP32-S3 wallet
                  sound: signed transaction             - MAX98357A + speaker

Online receiver  ------------------------------->  selected EVM RPC
                  validate, broadcast, receipt
```

## Trust Model

- The receiver is an untrusted transaction-request generator and broadcaster.
- The wallet independently checks the chain policy, recipient, amount, fees, nonce, and calldata.
- The physical approval button will be required before a production signature is produced; it is deferred in the current bench flow.
- The audio channel transports data; it does not grant signing authority.

## Current Implementation Boundary

- Receiver: keyless, multi-chain native-transfer flow with strict signed-transaction validation.
- Browser transport: legacy text messages remain available for bring-up; dynamic chunking and runtime sample-rate selection are implemented.
- Firmware: ESP-IDF scaffold, GPIO/I2S setup, frame CRC component, wallet states, and fail-closed signing interface.
- Production secure element, OLED driver, native ggwave component, and ECDSA implementation require hardware/toolchain validation.
