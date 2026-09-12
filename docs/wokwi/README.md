# Wokwi Visualization

Open [Wokwi](https://wokwi.com), create an ESP32-S3 project, and replace its `diagram.json` with `docs/wokwi/diagram.json` from this repository.

The diagram visualizes:

- ESP32-S3 GPIO 8/9 to SSD1306 I2C
- ESP32-S3 GPIO 17/18 are reserved for future Approve/Reject buttons and are not used in the current bench firmware
- Ground and 3.3 V connections

Wokwi does not simulate the actual INMP441-to-MAX98357A audio chain or ggwave acoustic behavior. The diagram labels those connections as physical-only. Use `docs/hardware-wiring.md` for the real breadboard assembly.

Button controls are reserved for the future approval flow and are not used by the current bench firmware.
