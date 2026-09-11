# Hardware Wallet Demo Script

## Setup

- ESP32-S3 wallet connected to INMP441, MAX98357A, speaker, OLED, and buttons.
- Receiver terminal opened at `/receive` with a testnet recipient address.
- Two test wallets funded with testnet assets.
- Wallet firmware clearly labelled development-only.

## Demo Flow

1. Show the receiver terminal with no private key or onboarding secret.
2. Select Monad Testnet, enter the recipient address and `0.01 MON`.
3. Start listening. The receiver hears the wallet announcement and fetches nonce/fee data.
4. Show the wallet OLED displaying network, amount, recipient, and fee.
5. Reject one request and show that no signed payload is emitted.
6. Start a fresh request and hold Approve for two seconds.
7. Show the wallet transmitting signed chunks by speaker.
8. Show the receiver validating sender, chain ID, recipient, amount, gas limit, and calldata policy.
9. Show the transaction hash and explorer receipt.
10. Repeat on Ethereum Sepolia to demonstrate chain ID separation.

## Evidence To Capture

- Video of the OLED review screen before approval.
- Video of Reject producing no signature.
- Serial output showing wallet address and development boundary.
- Receiver screen showing no private-key field.
- Explorer links for successful testnet transactions.
- A README section separating pre-existing PWA work from this hardware-wallet work.

## Honest Limitations

The development firmware is not a production hardware wallet. Do not use mainnet funds until secure-element signing, secure boot, flash encryption, firmware update policy, and an independent security review are complete.
