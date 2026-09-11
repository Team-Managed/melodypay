# MelodyPay Receiver Web App

This React application contains only:

- The public MelodyPay landing page
- The keyless online receiver at `/receive`

It never stores or imports a sender private key. Hardware-wallet firmware is in `../esp32/`; the interactive operator CLI is in `../cli/`; Solidity code belongs in `../contracts/`.
