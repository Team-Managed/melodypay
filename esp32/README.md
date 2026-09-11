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

## Bare ESP32-S3 Bring-up

The default `MELODY_BARE_BOARD_DIAGNOSTIC` mode is designed for the board by itself. Connect only a USB data cable; do not connect the microphone, amplifier, OLED, speaker, or buttons yet.

```bash
idf.py set-target esp32s3
idf.py -p COM_PORT flash monitor
```

Expected serial behavior:

- NVS initializes the development-only key store.
- The log reports `bare-board diagnostic mode` and `Audio ready` is not claimed.
- Approve/Reject GPIO state changes are logged if buttons are later connected.
- No I2S pins are driven in bare-board mode.

After the modules are assembled and rail voltages are checked, run `idf.py menuconfig`, disable `MelodyPay wallet -> Bare-board diagnostic mode`, then rebuild and flash.

## Current Boundary

The scaffold initializes buttons and I2S channels and provides the protocol/state interfaces. The display driver and production signing backend are intentionally fail-closed. Do not fund this firmware with real assets.
