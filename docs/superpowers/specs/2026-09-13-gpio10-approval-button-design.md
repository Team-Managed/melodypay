# GPIO10 Approval Button Design

## Goal

Add one physical approval input for bench transaction testing using GPIO10, with active-low debounce and a fail-closed timeout.

## Wiring

```text
ESP32-S3 GPIO10 ---- tactile button ---- GND
```

GPIO11 through GPIO14 remain unused for future expansion. GPIO10 uses the ESP32 internal pull-up and is considered pressed when read low.

## Behavior

- Button debounce: 30 ms stable-low requirement.
- Default approval timeout: 10 seconds.
- Press before timeout: return `approved`.
- Timeout: return `timeout`.
- Invalid hardware state or disconnect: return failure without approval.
- A button press outside an active approval window has no effect.
- The operation does not sign or broadcast anything; it only supplies the physical approval result.

## Interfaces

- Firmware console: `button_test [seconds]`.
- Firmware structured API: `wallet.wait_approval` with optional `timeout_seconds`.
- CLI device manager: `Test approval button`, showing approved/timeout/error results.

## Safety

- Approval is separate from signing.
- Existing signing functions remain fail-closed.
- No private key material is exposed.
- A timeout or disconnect is always treated as rejection.

## Verification

- Build and flash ESP32 firmware.
- Run `button_test 3` without pressing; verify timeout.
- Run `button_test 10`, press GPIO10 within the window; verify approved.
- Call `wallet.wait_approval` through the CLI; verify the same timeout/press behavior.
- Run the existing firmware, CLI, and web test suites.
