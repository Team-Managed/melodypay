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

## Hardware Bring-up

The firmware now initializes the microphone and amplifier I2S channels on every boot. Connect the assembled modules, verify the rails with a multimeter, then build and flash:

```bash
idf.py set-target esp32s3
idf.py -p COM_PORT flash monitor
```

The OLED driver remains serial-only and the production signing backend remains fail-closed until those components are implemented and reviewed.

## Current Boundary

The scaffold initializes buttons and I2S channels and provides the protocol/state interfaces. The display driver and production signing backend are intentionally fail-closed. Do not fund this firmware with real assets.
