# Chain-Agnostic CLI Wallet Design

## Status

Approved direction; implementation pending.

## Goal

Turn the existing receiver CLI into an interactive operator dashboard and add a structured USB control path for the ESP32 wallet without requiring users to memorize commands or follow a chain-specific setup wizard.

The normal payment flow remains chain-agnostic: the user selects any supported network when creating a payment, and the same request, validation, transport, and broadcast flow is used for that network.

## Current Boundaries

- The CLI currently creates payment requests, validates pasted signed EIP-1559 transactions, and broadcasts them.
- The firmware currently exposes a human UART console with audio, OLED, ggwave, and diagnostic commands.
- The firmware signing boundary is fail-closed: `keystore_sign_digest()` and `evm_sign_eip1559()` return `ESP_ERR_NOT_SUPPORTED`.
- No secure element or reviewed production signing backend is installed.
- The current implementation must not pretend that a payment was signed by hardware when it was not.

## User Experience

The CLI starts directly in a menu-driven dashboard:

- Dashboard
- USB wallet manager
- Wallet/device status
- Network profiles
- Payment terminal
- Audio diagnostics
- OLED/display diagnostics
- Inspect signed transaction
- Exit

Every action is selectable through prompts. The UI shows capability state and actionable explanations for unavailable operations. It does not require command memorization.

## Chain-Agnostic Payment Flow

The payment terminal:

1. Selects one of the configured chain profiles.
2. Accepts merchant recipient and amount.
3. Uses the selected chain RPC to fetch nonce and fee data.
4. Displays the complete request before transport.
5. Sends the request through the configured audio/device adapter when available.
6. Accepts the signed transaction from the hardware adapter or explicit external fallback.
7. Validates chain ID, sender, recipient, amount, nonce, calldata, and transaction type.
8. Broadcasts through the selected chain RPC and displays the explorer URL.

No chain receives a special setup path. Chain profiles are data, not branches in the UI.

## USB Control Protocol

The firmware will expose a structured line-delimited JSON protocol on the same USB serial transport, separate from the human REPL. Each request contains an operation and request ID:

```json
{"id":1,"op":"device.info"}
```

Each response contains the same ID, success state, and either result or error:

```json
{"id":1,"ok":true,"result":{"firmware":"...","capabilities":["audio","display"]}}
```

Initial operations:

- `device.info`: firmware version, hardware identity, protocol version, capabilities.
- `device.status`: wallet state, audio/display availability, signer capability state.
- `display.text`: render diagnostic text on the OLED.
- `audio.self_test`: run the existing audio diagnostic.
- `audio.mic_playback`: record and play microphone audio.
- `ggwave.self_test`: run native encode/decode validation.
- `wallet.capabilities`: report whether address derivation and signing are available.
- `wallet.configure`: store non-secret device preferences such as active chain profile.

The protocol never exports private key material. Unsupported operations return explicit errors rather than silently falling back to unsafe behavior.

## CLI Architecture

Create focused modules:

- `cli/src/serial.ts`: serial port discovery, connection lifecycle, line framing, request IDs, timeout handling.
- `cli/src/device.ts`: typed USB operations and capability mapping.
- `cli/src/ui.ts`: shared prompt helpers, status panels, and error formatting.
- `cli/src/index.ts`: top-level dashboard and flow routing.
- `cli/src/receiver.ts`: chain-agnostic request, validation, and broadcast logic.

The CLI uses `serialport` for USB discovery and transport. A disconnected wallet is a normal state; the dashboard can still run receiver-only flows.

## Error Handling

- USB unavailable: show detected ports and installation/permission guidance.
- Device protocol mismatch: show required and detected protocol versions.
- Device capability missing: explain that signing is not currently available and offer external signed-transaction fallback where safe.
- RPC failure: identify the selected chain and endpoint without exposing secrets.
- Invalid signed transaction: show the exact validation mismatch.
- Timeouts: allow return to dashboard without terminating the CLI.

## Security Constraints

- Never export or print private keys.
- Never broadcast an unsigned or pseudo-signed transaction.
- Never label an externally signed transaction as hardware-signed.
- Keep the firmware signer fail-closed until a reviewed secp256k1/Keccak implementation or secure element is installed.
- Require explicit confirmation before broadcast.

## Testing

- Unit test serial JSON request/response framing, request IDs, malformed lines, timeouts, and unsupported operations.
- Unit test chain-agnostic payment validation across all configured chain profiles.
- Firmware-build verification for the structured protocol component.
- CLI TypeScript build verification.
- Manual USB verification: discover port, connect, query info/status, render OLED text, run audio diagnostics, and handle disconnect.
- Manual payment verification with an externally signed testnet transaction until hardware signing is available.

## Out Of Scope For This Iteration

- Implementing a fake software signer.
- Exporting private keys.
- Claiming end-to-end hardware signing before the signer backend is reviewed and installed.
- Chain-specific setup wizards or chain-specific UI branches.
