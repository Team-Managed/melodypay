# MelodyPay Hardware Shopping List

Prices below are the prices supplied for this project from the Indian retailer listing. Prices, stock, and shipping can change; verify before ordering.

## Buy For The First Prototype

| Qty | Part | Selected item | Price supplied | Notes |
|---:|---|---|---:|---|
| 1 | Controller | ESP32-S3 DevKit, WROOM-1 N16R8, 16 MB flash + 8 MB PSRAM | ₹839 | Suitable for firmware, audio buffers, display, and USB programming. |
| 1 | Microphone | INMP441 MEMS omnidirectional I2S module | Check listing | Correct choice. Connect as a digital I2S microphone, not through an analog ADC. |
| 1 | I2S amplifier | Generic MAX98357A I2S amplifier breakout | ₹170 listed | Preferred over the ₹699 DFRobot version for a bench prototype. |
| 1 | Speaker | 0.5 W, 28 mm, 8 ohm speaker | ₹29 listed | Sufficient for short-range indoor ggwave testing. |
| 1 | Display | 0.96 inch SSD1306 128x64 I2C OLED | ₹162 | Correct size for the prototype. Use multiple screens for a full address. |
| 2 | Buttons | 12x12x7.3 mm tactile switches | ₹144 for 25 | Use two: Approve and Reject. |
| 1 | Breadboard | 830-point solderless breadboard | Check listing | Needed to assemble and change the circuit cleanly. |
| 1 pack | Jumper wires | Male-male and male-female Dupont wires | Check listing | Buy both types; module headers vary. |
| 1 | USB cable | Data-capable USB cable matching the DevKit connector | Check listing | Required for flashing and serial logs; charge-only cables fail. |
| 1 | Power | USB 5 V adapter or power bank | Existing preferred | Use USB power during the bench prototype. |

## Extra Tools Worth Buying

- 2.54 mm male header pins if the INMP441, MAX98357A, or OLED arrives without headers.
- Small soldering iron, solder, flux, and side cutters for attaching headers.
- Multimeter for checking 3.3 V, 5 V, ground, and accidental shorts.
- Shorter Dupont wires for I2S. Long loose wires can reduce audio reliability.

## Do Not Buy Yet

- Battery and charging board
- Enclosure
- Touchscreen
- Bluetooth audio board
- Wi-Fi module or Raspberry Pi
- High-power amplifier
- Camera, NFC, SD card, haptics, or GPS
- Custom PCB

## Amplifier Choices

### Recommended

**Generic MAX98357A I2S breakout, ₹170 listed.** It accepts digital I2S directly from the ESP32-S3 and drives a small speaker. This keeps the audio path simple:

```text
ESP32-S3 I2S data -> MAX98357A -> 8-ohm speaker
```

### Alternative

**DFRobot MAX98357 I2S module, ₹699 listed.** Electrically appropriate and likely easier to document, but it is not needed for the cheapest prototype.

### Avoid for this prototype

TPA3118, TPA3110, TDA7293, TDA7297, TDA2030A, TDA1521, PAM8403 Bluetooth boards, CA-6928 Bluetooth boards, and LM386 modules. These are analog, Bluetooth, or high-power amplifier solutions and are not direct replacements for an I2S MAX98357A path. They add power and wiring requirements without improving ggwave bench testing.

## Display Choice

The listed **0.96-inch 128x64 SSD1306 I2C OLED at ₹162 is appropriate**. It is enough to show:

1. Chain name and chain ID.
2. Asset and amount.
3. Recipient pages.
4. Fee and expiration.
5. `APPROVE` and `REJECT` prompts.

It is not large enough to show a full address on one screen, so the firmware must paginate the address and use a checksum or first/last-character confirmation pattern. A larger display is unnecessary for the first prototype.

## Production-Security Parts, Not First-Bench Parts

| Part | Purpose | Shopping guidance |
|---|---|---|
| secp256k1-capable secure element | Non-exportable Ethereum key generation and signing | Select only after verifying the exact chip supports secp256k1 signatures, ESP32-S3 integration, tooling, and supply. Do not substitute an arbitrary P-256 secure element. |
| Custom PCB | Short, reliable I2S wiring and repeatable assembly | Design after the breadboard audio and button behavior are proven. |
| Secure boot provisioning | Prevent unauthorized firmware replacement | Required for a product revision, not a first wiring test. |
| Flash encryption | Protect non-key device data and firmware storage | Enable and document after the firmware update path is understood. |
| Enclosure | Physical protection and productization | Wait until the PCB and button/display layout are stable. |

## Approximate First-Bench Total

Using the prices supplied for the controller, buttons, OLED, generic amplifier, and speaker gives **₹1,344 before microphone, breadboard, wires, cable, and shipping**. A realistic complete bench order is approximately **₹1,600-2,000**, depending on those missing prices.

This estimate excludes the secure element. The secure element belongs in the next security milestone and should not be represented as present in the first bench prototype unless its exact part and signing support have been verified.

## Wiring Checklist

- ESP32-S3 and all digital modules share ground.
- INMP441 uses 3.3 V, ground, I2S clock, word-select, and data; follow the exact breakout pin labels.
- MAX98357A uses its documented supply voltage, ground, I2S clock, word-select, and data; do not assume every clone labels pins identically.
- OLED uses I2C SDA, SCL, 3.3 V, and ground.
- Buttons connect to GPIO inputs with pull-ups or pull-downs and are debounced in firmware.
- Keep microphone and amplifier wiring physically separated where practical.
- Verify voltage with a multimeter before connecting audio modules.
