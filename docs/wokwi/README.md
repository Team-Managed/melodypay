# Wokwi Visualization

Open [Wokwi](https://wokwi.com), create an ESP32-S3 project, and replace its `diagram.json` with `docs/wokwi/diagram.json` from this repository.

The diagram visualizes:

- ESP32-S3 GPIO 8/9 to SSD1306 I2C
- ESP32-S3 GPIO 1/2 to Approve/Reject buttons
- Ground and 3.3 V connections

Wokwi does not simulate the actual INMP441-to-MAX98357A audio chain or ggwave acoustic behavior. The diagram labels those connections as physical-only. Use `docs/hardware-wiring.md` for the real breadboard assembly.

The Wokwi button keyboard shortcuts are:

- `A`: Approve
- `R`: Reject
