# MelodyPay Receiver CLI

This is the standalone online receiver terminal. It has no sender private key. It fetches nonce/fee data, creates a payment request, validates the signed native EVM transaction, and broadcasts it through the selected RPC.

The audio adapter is intentionally separate from transaction validation. The current CLI accepts a signed transaction on stdin so the protocol can be tested without hardware; a native ggwave adapter will feed the same validation function later.

```bash
npm install
npm start -- --chain 10143 --to 0x... --amount 0.01 --sender 0x...
```
