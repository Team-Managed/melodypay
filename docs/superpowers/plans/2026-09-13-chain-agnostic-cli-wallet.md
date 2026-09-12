# Chain-Agnostic CLI Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a menu-driven, chain-agnostic CLI dashboard with USB device management and a structured ESP32 control protocol.

**Architecture:** Keep the existing receiver validation/broadcast functions as the payment core. Add a line-oriented `api <json>` command to the firmware REPL as a safe structured control boundary, then wrap it with a Node serial client and expose device operations through the CLI dashboard. Signing remains capability-reported and fail-closed.

**Tech Stack:** ESP-IDF C/C++, cJSON, FreeRTOS UART console, Node.js, TypeScript, `serialport`, `@clack/prompts`, ethers v6, Vitest.

## Global Constraints

- No chain-specific setup wizard; chain profiles remain selectable data.
- Never export or print private keys.
- Never broadcast an unsigned or pseudo-signed transaction.
- Never label an externally signed transaction as hardware-signed.
- Keep firmware signing fail-closed until a reviewed signer backend or secure element exists.
- A disconnected wallet remains a supported receiver-only state.
- Preserve the current human UART diagnostics console.

---

### Task 1: Add Firmware Structured API

**Files:**
- Create: `esp32/main/device_api.h`
- Create: `esp32/main/device_api.c`
- Modify: `esp32/main/CMakeLists.txt`
- Modify: `esp32/main/main.c`
- Modify: `esp32/main/keystore.h` only if capability information needs a public accessor

**Interfaces:**
- Produces `int device_api_command(int argc, char **argv)` for the `api` console command.
- Accepts compact JSON reconstructed from `argv[1..]`.
- Emits one JSON response line per request with fields `id`, `ok`, and `result` or `error`.

- [ ] **Step 1: Add protocol tests for response construction**

Create host-testable helpers for request ID extraction, unknown operations, malformed JSON, and error response shape.

- [ ] **Step 2: Implement `device.info` and `device.status`**

Return firmware version, protocol version, ESP32-S3 identity, display/audio availability, current wallet state, and capabilities. Report `signing: false`, `address_derivation: false`, and `private_key_export: false` explicitly.

- [ ] **Step 3: Implement diagnostic operations**

Implement `display.text`, `audio.self_test`, `audio.mic_playback`, and `ggwave.self_test` by calling the existing tested functions. Return ESP error names and operation results rather than raw console output.

- [ ] **Step 4: Implement chain-agnostic non-secret configuration**

Implement `wallet.configure` for an active chain ID after validating it with `evm_chain_is_allowed`. Store only the selected chain ID in NVS; do not modify key material. Return `ESP_ERR_NOT_SUPPORTED` for signing/address operations.

- [ ] **Step 5: Register `api` and build firmware**

Register `api` alongside the existing commands. Run `idf.py build`; verify malformed and unknown requests return JSON without crashing the REPL.

### Task 2: Add CLI Serial Transport

**Files:**
- Modify: `cli/package.json`
- Modify: `cli/package-lock.json`
- Create: `cli/src/serial.ts`
- Create: `cli/src/device.ts`
- Test: `cli/src/serial.test.ts`

**Interfaces:**
- `listSerialPorts(): Promise<SerialPortInfo[]>`.
- `connectDevice(path: string): Promise<DeviceConnection>`.
- `DeviceConnection.request<T>(operation: string, params?: Record<string, unknown>): Promise<T>`.
- `DeviceConnection.close(): Promise<void>`.

- [ ] **Step 1: Add serial dependencies and failing framing tests**

Add `serialport` and `@serialport/parser-readline`. Test JSON request IDs, unrelated console lines, malformed response lines, response timeouts, and matching response selection.

- [ ] **Step 2: Implement port discovery and connection lifecycle**

List USB serial devices with path, manufacturer, serial number, and product ID. Open at 115200 baud and close cleanly on errors or menu exit.

- [ ] **Step 3: Implement request/response framing**

Send compact requests as `api {json}\n`; parse newline-delimited JSON responses and ignore boot logs, prompts, and unrelated REPL text until the matching ID arrives. Timeout requests after 3 seconds.

- [ ] **Step 4: Implement typed device operations**

Expose `getInfo`, `getStatus`, `setActiveChain`, `renderText`, `runAudioSelfTest`, `runMicPlayback`, and `runGGWaveSelfTest`. Convert firmware error responses into typed `DeviceApiError` instances.

- [ ] **Step 5: Run CLI tests and typecheck**

Run `npm test` for the serial tests and `npm run build` in `cli`.

### Task 3: Build the Interactive Dashboard

**Files:**
- Create: `cli/src/ui.ts`
- Modify: `cli/src/index.ts`
- Modify: `cli/src/chains.ts` only for display metadata if required

**Interfaces:**
- Produces menu actions for Dashboard, USB wallet manager, device status, network profiles, payment terminal, audio diagnostics, OLED diagnostics, signed transaction inspection, and exit.
- Consumes `DeviceConnection` from Task 2 and existing receiver functions.

- [ ] **Step 1: Add shared UI helpers**

Implement reusable prompts for selecting a connected device, selecting chain profiles, confirming broadcasts, rendering JSON/status panels, and returning to the main menu.

- [ ] **Step 2: Add USB wallet manager flow**

Show discovered serial ports, connect/disconnect, query device info/status, configure active chain, and display capability state. If signing is unavailable, show that explicitly and do not offer a misleading sign action.

- [ ] **Step 3: Add diagnostics flows**

Expose audio self-test, microphone record/playback, ggwave self-test, and OLED text test without requiring users to type firmware commands.

- [ ] **Step 4: Preserve and improve receiver flows**

Keep payment terminal, signed transaction inspection, and network profiles accessible from the dashboard. Add explicit external-signed-transaction fallback labeling and explorer links after broadcast.

- [ ] **Step 5: Handle disconnects and return navigation**

Every submenu must return to the dashboard without process termination. Device disconnects must clear the connection and offer a reconnect path.

### Task 4: Integrate Normal Payment Capability Reporting

**Files:**
- Modify: `cli/src/index.ts`
- Modify: `cli/src/receiver.ts`
- Modify: `cli/src/device.ts`

- [ ] **Step 1: Show selected chain and device state before request creation**

Display the selected chain, RPC endpoint, wallet connection state, and signer capability before asking for recipient and amount.

- [ ] **Step 2: Use device capability routing**

If a future device reports audio/signing capabilities, route the payment adapter through it. With the current firmware, route to the safe external signed-transaction fallback and state that no hardware signature was produced.

- [ ] **Step 3: Keep validation chain-agnostic**

Use the selected chain profile for nonce, fee, chain ID validation, recipient/value/nonce checks, and broadcast. Do not add Monad-only branches.

### Task 5: Verify, Commit, and Push

**Files:**
- Modify only files required by failed verification.

- [ ] **Step 1: Run firmware build**

Run `idf.py build` from `esp32`.

- [ ] **Step 2: Run CLI tests and typecheck**

Run the serial framing tests and `npm run build` from `cli`.

- [ ] **Step 3: Run existing application tests**

Run `npm test` and `npm run build` at the repository root.

- [ ] **Step 4: Perform USB bench verification**

Flash firmware, connect through the CLI, query status, render OLED text, run audio diagnostics, disconnect the USB cable, and reconnect.

- [ ] **Step 5: Commit and push**

Inspect `git status`, `git diff`, and recent log; stage only intended firmware, CLI, tests, and documentation files. Commit with `feat: add chain-agnostic wallet dashboard` and push `main`.
