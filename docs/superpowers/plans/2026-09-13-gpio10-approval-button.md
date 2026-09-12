# GPIO10 Approval Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a debounced active-low GPIO10 approval button with console, USB API, and CLI test paths.

**Architecture:** Create a small firmware button module that owns GPIO configuration and debounced polling. Expose the same blocking approval wait through the human console and structured USB API, then add a CLI device-manager action that displays approved/timeout/error results. Signing remains separate and fail-closed.

**Tech Stack:** ESP-IDF GPIO/FreeRTOS, C, cJSON USB API, TypeScript Node CLI, `@clack/prompts`, serialport.

## Global Constraints

- GPIO10 is the approval input; GPIO11 through GPIO14 remain unused.
- The button is active-low with the ESP32 internal pull-up.
- Button debounce requires 30 ms of stable-low input.
- Default approval timeout is 10 seconds.
- Timeout, disconnect, or invalid state never approves.
- Approval does not sign or broadcast a transaction.
- Existing signing functions remain fail-closed.

---

### Task 1: Add the Firmware Button Driver

**Files:**
- Create: `esp32/main/button.h`
- Create: `esp32/main/button.c`
- Modify: `esp32/main/CMakeLists.txt`
- Modify: `esp32/main/main.c`

**Interfaces:**
- `esp_err_t button_init(void)`.
- `bool button_is_pressed(void)`.
- `esp_err_t button_wait_for_approval(uint32_t timeout_ms)`.

- [ ] **Step 1: Implement GPIO10 initialization**

Configure GPIO10 as an input with `GPIO_PULLUP_ONLY`, no output, and active-low semantics. Return the ESP-IDF error instead of continuing if configuration fails.

- [ ] **Step 2: Implement debounced polling**

Poll every 10 ms. Require three consecutive low reads before returning `ESP_OK`. Return `ESP_ERR_TIMEOUT` after the requested duration. Ignore an already-held button until it is released and pressed again so a stale press cannot approve a later operation.

- [ ] **Step 3: Initialize the button during `app_main`**

Call `button_init()` after NVS and before the console starts. Log the configured GPIO and active-low mode.

### Task 2: Add Console and USB Approval Operations

**Files:**
- Modify: `esp32/main/main.c`
- Modify: `esp32/main/device_api.c`
- Modify: `esp32/main/device_api.h` only if a helper declaration is needed

**Interfaces:**
- Console command: `button_test [seconds]`.
- JSON operation: `wallet.wait_approval` with optional `{ "timeout_seconds": number }`.

- [ ] **Step 1: Add the failing behavior checks**

Verify the command returns timeout without a press and returns success after a physical press. The USB response must contain `approved`, `timeout`, or an explicit error.

- [ ] **Step 2: Implement `button_test`**

Accept 1–60 seconds, default to 10, print `press GPIO10 to approve`, call `button_wait_for_approval`, and print `approval=approved` or `approval=timeout`.

- [ ] **Step 3: Implement `wallet.wait_approval`**

Validate the timeout range, call the button driver, and return JSON such as `{ "decision": "approved" }` or `{ "decision": "timeout" }`. Do not call any signing function.

- [ ] **Step 4: Build and flash firmware**

Run `idf.py build` and flash the image to `COM4`.

### Task 3: Add CLI Approval Test

**Files:**
- Modify: `cli/src/device.ts`
- Modify: `cli/src/index.ts`
- Modify: `cli/src/serial.node-test.ts` if response parsing coverage is needed

**Interfaces:**
- `DeviceClient.waitForApproval(timeoutSeconds: number): Promise<{ decision: "approved" | "timeout" }>`.
- Dashboard device diagnostics option: `Test approval button`.

- [ ] **Step 1: Add the typed device method**

Call `wallet.wait_approval` and return the typed decision.

- [ ] **Step 2: Add the interactive menu action**

Require a connected device, ask for timeout seconds with a default of 10, invoke the operation, and print a clear result. A timeout is a normal result, not an exception.

- [ ] **Step 3: Run CLI build and tests**

Run `npm run build` and `npm test` from `cli`.

### Task 4: Verify Physical Approval Behavior

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Verify timeout**

Run `button_test 3` without touching GPIO10. Confirm `approval=timeout` and no wallet state transition.

- [ ] **Step 2: Verify physical approval**

Wire GPIO10 to one button contact and GND to the opposite contact. Run `button_test 10`, press the button within the window, and confirm `approval=approved`.

- [ ] **Step 3: Verify USB approval**

Use the CLI dashboard’s `Test approval button` action and repeat both timeout and press cases.

- [ ] **Step 4: Run repository verification**

Run root `npm test`, root `npm run build`, CLI `npm run build`, CLI `npm test`, and ESP-IDF `idf.py build`.

### Task 5: Commit and Push

- [ ] **Step 1: Inspect final status and diff**

Run `git status`, `git diff --check`, `git diff --stat`, and `git log --oneline -5`.

- [ ] **Step 2: Commit and push**

Stage only the button driver, CLI/API changes, tests, and documentation. Commit with `feat: add GPIO10 approval button` and push `main`.
