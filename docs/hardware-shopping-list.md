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
| 2 | Buttons | 12x12x7.3 mm tactile switches | ₹144 for 25 | Future production approval controls; not required for current bench flow. |
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
3. Recipient address (EIP-55 format across 2 lines).
4. Fee and expiration.
5. `APPROVE` and `REJECT` prompts.

The full 42-character EIP-55 address fits on a single review screen using 2 lines (21 characters per line at the 6×8 font). There is no need to paginate the address across multiple screens. A larger display is unnecessary for the first prototype.

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

## Verified GPIO Pinout Matrix (ESP32-S3 N16R8)

> [!WARNING]
> **Octal SPI Flash/PSRAM Warning:** The ESP32-S3 WROOM-1 N16R8 module uses Octal Flash and Octal PSRAM. **GPIO 33 through GPIO 37 are permanently wired to internal SPI memory and MUST NEVER BE USED.** Strapping pins (GPIO 0, 3, 45, 46) and native USB-JTAG pins (GPIO 19, 20) are reserved or avoided below.

| Peripheral | Signal | Breakout Pin Label | ESP32-S3 GPIO | Electrical Notes |
|---|---|---|---|---|
| **INMP441 (Mic)** | Bit Clock (BCLK) | `SCK` | **GPIO 4** | I2S0 Serial Clock |
| | Word Select (WS) | `WS` | **GPIO 5** | I2S0 Word Select (L/R Clock) |
| | Serial Data (SD) | `SD` | **GPIO 6** | I2S0 Serial Data In |
| | Channel Select | `L/R` | **GND** | Pull to GND for Left Channel |
| | Power & Ground | `VDD`, `GND` | **3.3V & GND** | **Strictly 3.3V! Connecting to 5V destroys the MEMS chip.** |
| **MAX98357A (Amp)** | Bit Clock (BCLK) | `BCLK` | **GPIO 15** | I2S1 Bit Clock |
| | Word Select (LRC) | `LRC` | **GPIO 16** | I2S1 Word Select |
| | Serial Data In | `DIN` | **GPIO 7** | I2S1 Serial Data Out |
| | Gain / Shutdown | `GAIN`, `SD` | `GAIN` unconnected, `SD` to 3.3V | Default 9dB gain; 3.3V enables the photographed board's shutdown input |
| | Power & Ground | `VIN`, `GND` | **5V (VBUS) & GND** | **CRITICAL: Connect VIN to 5V (USB VBUS), NOT 3.3V!** |
| **SSD1306 (OLED)** | Serial Data | `SDA` | **GPIO 8** | I2C Data (requires 3.3V pull-ups on breakout) |
| | Serial Clock | `SCL` | **GPIO 9** | I2C Clock |
| | Power & Ground | `VCC`, `GND` | **3.3V & GND** | Standard 3.3V logic |
| **Tactile Buttons** | Future Approve Button | Pin 1 / Pin 2 | **GPIO 17 & GND** | Deferred; not part of current bench flow |
| | Future Reject Button | Pin 1 / Pin 2 | **GPIO 18 & GND** | Deferred; not part of current bench flow |

---

## Wiring & Electrical Checklist

- **Speaker Acoustic Cutoff Warning:** The 28mm 0.5W speaker drops off sharply above ~10–12 kHz. It physically cannot generate the 18–20 kHz frequencies required for ultrasonic ggwave. **Bench testing must strictly use Audible Mode (Protocol 2, ~1.5–3.5 kHz).**
- **High-Frequency I2S Wire Length (Crucial):** The I2S bit clock runs at 3.072 MHz. Standard 20cm Dupont jumper wires act as RF antennas and cause bit slips. **Keep I2S wires (BCLK, WS, SD) short ($\le 10\text{ cm}$)** and run a ground wire parallel to the clock lines to dampen electromagnetic ringing.
- **INMP441 Channel Pin Grounding:** The `L/R` pin on the microphone breakout must be firmly wired to **GND** (Left channel). If left floating, the microphone fluctuates into high-impedance mode, causing intermittent zero-byte audio buffers.
- **Power Rails (Crucial):**
  - **MAX98357A MUST be powered from 5V (VBUS / USB 5V pin):** Driving an 8Ω speaker from the ESP32-S3's on-board 3.3V LDO regulator causes voltage dips during audio bursts, triggering the ESP32-S3 hardware brownout detector (`Brownout detector was triggered`). Connecting to 5V provides clean power with zero MCU brownouts.
  - **INMP441 MUST be powered from 3.3V:** The MEMS sensor is not 5V tolerant.
- **MAX98357A speaker power:** At 5V the amplifier can deliver more power than the listed 0.5W speaker should continuously receive. Start with a low firmware volume and stop immediately if the speaker distorts or becomes hot.
- **Common Ground:** ESP32-S3, OLED, INMP441, and MAX98357A must all share a common ground plane on the breadboard.
- **Physical Wire Routing:** Keep the INMP441 microphone wires physically separated from the MAX98357A speaker output leads to prevent inductive noise pickup on high-gain audio inputs.
- **Half-Duplex Operation in Firmware:** During audio transmission from MAX98357A, the firmware must mute/ignore the INMP441 microphone DMA stream to prevent self-echo and buffer corruption.
- **Verify with Multimeter:** Always test voltages with a multimeter at the breadboard power rails before inserting the ESP32-S3 and breakout boards.
