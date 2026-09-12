# ESP32-S3 Hardware Test Report

## Test Environment

- Board: ESP32-S3 N16R8
- Serial port: `COM4` using CH343
- ESP-IDF: `v5.5.5`
- Firmware mode: assembled hardware mode, no bare-board bypass
- Date: September 12, 2026

## Automated Results

The firmware was built, flashed, and booted successfully.

| Test | Result | Evidence |
|---|---|---|
| ESP32-S3 boot | Pass | Bootloader and application started |
| Flash/PSRAM | Pass | 16 MB flash detected; 8 MB PSRAM test passed |
| I2S microphone channel | Pass | `mic_read=ESP_OK`, 256 samples received |
| I2S amplifier channel | Pass | `tone_write=ESP_OK` |
| OLED I2C | Pass | SSD1306 detected at address `0x3c` |
| NVS development backend | Pass | Development key backend initialized |
| Native ggwave initialization | Pass | Fixed 64-byte frame mode initialized without panic |
| ggwave transmit command | Pass | `tx hello` encoded 46,080 I2S samples and returned `ESP_OK` |
| ggwave receive command | Pass | `rx 2` sampled and decoded for two seconds without panic |
| Stability | Pass | No brownout or panic during the test window |

## Manual Checks Remaining

- Confirm the short test tone is audible through the speaker.
- Confirm the OLED checkerboard test pattern is visible.
- Run a physical two-device acoustic loopback test; the current runtime test had no external payload source.
- Button validation is deferred; GPIO17/GPIO18 are reserved for the future approval flow.
- Keep the volume low; the amplifier can exceed the small speaker's continuous rating.

This confirms electrical initialization, native ggwave setup, waveform transmission, and receive-loop stability. It does not validate acoustic decode reliability, secure signing, or production key custody.
