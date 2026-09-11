# MelodyPay Breadboard Wiring

This guide matches the boards shown in the photos:

- ESP32-S3 N16R8 carrier board
- INMP441 I2S microphone with `L/R`, `WS`, `SCK`, `SD`, `VDD`, `GND`
- MAX98357A amplifier marked `VIN`, `GND`, `SD`, `GAIN`, `DIN`, `LRC`, `BCLK`
- 0.96-inch SSD1306 OLED marked `GND`, `VDD`, `SCK`, `SDA`
- 8-ohm speaker
- Two 12 mm tactile switches

The Wokwi partial visual is at `docs/wokwi/diagram.json`. The real microphone and amplifier are physical-only in that simulator, so follow this document for those connections.

The beginner-friendly placement drawing is `docs/breadboard-assembly.svg`. Open it in a browser while assembling.

## How A Breadboard Works

A solderless breadboard is a group of hidden metal clips. The holes are not all connected together.

```text
Left half                         Right half
a  b  c  d  e       center gap    f  g  h  i  j
o  o  o  o  o          ||          o  o  o  o  o   row 1
o  o  o  o  o          ||          o  o  o  o  o   row 2
o  o  o  o  o          ||          o  o  o  o  o   row 3
```

- The five holes `a-e` on one row are connected internally.
- The five holes `f-j` on the same row are connected internally.
- The center gap separates the left five holes from the right five holes.
- Holes on different numbered rows are not connected.
- The long red and blue side rails are power buses. Red is normally positive and blue is normally ground.
- Your photographed board has continuous long power rails from row 1 to row 60. The left and right rails are still separate from each other.

Think of a row as a small hidden wire. Put a component leg in one hole and a jumper in another hole on the same row to connect them.

## Before Inserting Parts

- Solder male header pins onto every module that has bare holes. Do not force loose jumper ends into module holes.
- Disconnect USB power while changing wiring.
- Place the ESP32-S3 so its two pin rows straddle the center gap. Its left-side pins go into the left half and right-side pins go into the right half.
- Keep the microphone and amplifier physically separated on the board.
- Use one rail for 3.3 V, one rail for 5 V, and one rail for GND. Never share the 3.3 V and 5 V rails.

## Recommended Placement

Use this order on a full-size breadboard:

```text
TOP OF BREADBOARD

  3V3 rail  =============================================
  GND rail  =============================================

       INMP441          ESP32-S3          MAX98357A
      microphone       across gap          amplifier
          [MIC]       [ USB BOARD ]           [AMP] ---- speaker

       OLED            APPROVE             REJECT
      [SCREEN]         [button]            [button]

  5V rail   =============================================
  GND rail  =============================================

BOTTOM OF BREADBOARD
```

The exact hole numbers are not important. The important rules are that the ESP32 straddles the gap, each button straddles the gap, and every jumper lands in the correct connected row or power rail.

## Your Exact Breadboard

Use the orientation from your photo: numbers increase from top to bottom, the center trench is in the middle, and columns `a-e` are on the left while `f-j` are on the right.

Use the rails as separate supplies:

```text
LEFT RED RAIL   = 3.3 V only
LEFT BLUE RAIL  = GND
RIGHT RED RAIL  = 5 V only
RIGHT BLUE RAIL = GND
```

The red rails on the left and right are not automatically connected to each other. Do not join them. The two blue rails may also be separate; connect them to the same ESP32 GND only if you need both sides of the board.

Suggested physical placement, using the printed row numbers on your 60-row board:

```text
Rows  3-6:   OLED header vertically on the left side
Rows 10,14:  Approve and Reject buttons across the center trench
Rows 20-41:  ESP32-S3 across the center trench
Rows 45-50:  INMP441 on the left side
Rows 45-51:  MAX98357A on the right side
```

The ESP32 board is wider than the center trench. Its body should sit over the trench while its two header rows enter the left and right terminal areas. The exact columns depend on the width of your soldered headers; do not force the board into holes that are not aligned.

Suggested module pin rows:

| Rows | Module pins | Placement |
|---|---|---|
| 3, 4, 5, 6 | OLED `VDD`, `GND`, `SCK`, `SDA` | One pin per numbered row on the left; do not put all four across one row |
| 10 | Approve switch | Across the center trench |
| 14 | Reject switch | Across the center trench |
| 45-50 | INMP441 `SCK`, `WS`, `SD`, `VDD`, `GND`, `L/R` | One pin per numbered row on the left where possible |
| 45-51 | MAX98357A `BCLK`, `LRC`, `DIN`, `VIN`, `GND`, `SD`, `GAIN` | One pin per numbered row on the right where possible |

If a module's header spacing does not fit these rows, use individual Dupont wires from each module pin. Never insert multiple pins from one module into the same connected `a-e` or `f-j` row, because that would short those pins together.

Connect the ESP32 power pins to the rails before connecting modules:

```text
ESP32 3V3 pin -> LEFT RED rail
ESP32 5V pin  -> RIGHT RED rail
ESP32 GND pin -> LEFT BLUE rail
```

Then connect each module's power wire to the correct rail. The red/blue colors are only a convention; verify the rails with a multimeter before USB power.

## Build In Small Tests

Do not wire everything and power it for the first time. Build and test in this order:

1. Insert the ESP32-S3 and connect only USB, 3V3, and GND rails.
2. Add the OLED. Test that it receives 3.3 V and is detected at I2C address `0x3C`.
3. Add the Approve and Reject buttons. Test each GPIO with the internal pull-up enabled.
4. Add the INMP441. Confirm its `VDD` is 3.3 V before connecting USB.
5. Add the MAX98357A power and I2S wires, but leave the speaker disconnected.
6. Connect the speaker between amplifier `+` and `-`, never to GND.
7. Start with very low firmware volume and test a short tone.
8. Only after these tests pass, test ggwave between the wallet and receiver.

## Pin Map

| Device pin | Connect to ESP32-S3 / rail | Purpose |
|---|---|---|
| INMP441 `SCK` | GPIO 4 | I2S bit clock |
| INMP441 `WS` | GPIO 5 | I2S word select |
| INMP441 `SD` | GPIO 6 | I2S microphone data into ESP32 |
| INMP441 `L/R` | GND | Select left audio channel |
| INMP441 `VDD` | 3V3 | Microphone power, 3.3 V only |
| INMP441 `GND` | GND | Common ground |
| MAX98357A `BCLK` | GPIO 15 | I2S bit clock |
| MAX98357A `LRC` | GPIO 16 | I2S word select |
| MAX98357A `DIN` | GPIO 7 | I2S amplifier data |
| MAX98357A `SD` | 3V3 | Enable amplifier; do not leave it floating |
| MAX98357A `GAIN` | Unconnected | Default 9 dB gain |
| MAX98357A `VIN` | 5V / VBUS | Amplifier power |
| MAX98357A `GND` | GND | Common ground |
| MAX98357A speaker `+` | Speaker terminal 1 | Bridged amplifier output |
| MAX98357A speaker `-` | Speaker terminal 2 | Bridged amplifier output |
| OLED `SCK` | GPIO 9 | I2C clock, also called SCL |
| OLED `SDA` | GPIO 8 | I2C data |
| OLED `VDD` | 3V3 | OLED power |
| OLED `GND` | GND | Common ground |
| Approve button | GPIO 1 and GND | Active-low input |
| Reject button | GPIO 2 and GND | Active-low input |

The firmware should configure GPIO 1 and GPIO 2 as `INPUT_PULLUP`. No external resistor is required for this first prototype.

## Breadboard Layout

Place the ESP32-S3 across the center trench of the breadboard, with the USB connectors facing the edge. Keep the microphone and amplifier on opposite sides of the breadboard. Keep I2S wires as short as possible, ideally 10 cm or less.

Create separate power rails:

```text
ESP32 3V3  ---> 3.3 V rail ---> INMP441 VDD, OLED VDD, MAX98357A SD
ESP32 5V   ---> 5 V rail   ---> MAX98357A VIN
ESP32 GND  ---> GND rail  ---> every module GND, INMP441 L/R, buttons
```

Do not bridge the 3.3 V rail to the 5 V rail. On your board, each side's red and blue rail runs continuously from the top to the bottom.

## Wiring Order

1. Disconnect USB power from the ESP32-S3.
2. Insert the ESP32-S3 across the breadboard center trench.
3. Connect ESP32 `GND` to the ground rail.
4. Connect ESP32 `3V3` to the 3.3 V rail.
5. Connect ESP32 `5V` or `VBUS` to the 5 V rail. On this board, use the pin visibly labelled `5V`, not `VIN`.
6. Wire the OLED to GPIO 8, GPIO 9, 3V3, and GND.
7. Wire the INMP441 to GPIO 4, GPIO 5, GPIO 6, 3V3, and GND. Connect its `L/R` pad firmly to GND.
8. Wire the MAX98357A I2S pins to GPIO 15, GPIO 16, and GPIO 7.
9. Connect MAX98357A `VIN` to 5V, `GND` to GND, `SD` to 3V3, and leave `GAIN` unconnected.
10. Connect the speaker between the amplifier `+` and `-` output terminals.
11. Insert each tactile switch across the breadboard center trench. Connect one contact side to its GPIO and the opposite contact side to GND.
12. Inspect every connection and measure the rails with a multimeter before connecting USB.

## Tactile Switch Orientation

The four legs of a typical tactile switch are not four independent contacts. Two legs on one side are already connected internally, and the two legs on the opposite side are the other contact. Pressing the switch joins the two sides.

Place the switch across the breadboard center trench. Use one leg from each side:

```text
GPIO 1 ---- [ APPROVE SWITCH ] ---- GND
GPIO 2 ---- [ REJECT SWITCH  ] ---- GND
```

If a button is placed entirely on one side of the breadboard trench, both wires may connect to the same internal contact and the button will appear permanently pressed or permanently open.

## Critical Amplifier Warning

The MAX98357A output is bridge-tied. The speaker output is not ground-referenced:

```text
MAX98357A OUT+ ---- speaker terminal 1
MAX98357A OUT- ---- speaker terminal 2
```

Do not connect `OUT+` or `OUT-` to ESP32 GND. Do not connect the speaker to the ESP32 directly. Start with low firmware volume because the 5 V amplifier can deliver more power than the small 0.5 W speaker should continuously receive.

## First Power Test

Before running audio:

1. Power the ESP32 from USB only.
2. Confirm the 3.3 V rail measures approximately 3.3 V and the 5 V rail approximately 5 V.
3. Confirm there is no continuity short between 3.3 V, 5 V, and GND.
4. Test OLED detection at I2C address `0x3C`.
5. Test both buttons with internal pull-ups.
6. Test the microphone clock/data path without the amplifier powered.
7. Power the amplifier and test a low-volume tone.
8. Only then test ggwave audio between the hardware wallet and the online receiver.

## Physical Placement

- Keep INMP441 and speaker physically separated to reduce acoustic feedback.
- Point the microphone away from the speaker during bring-up.
- Keep BCLK, WS/LRC, and data wires short and route a ground wire alongside them.
- Use the audible ggwave profile for this speaker; do not use ultrasonic mode with this prototype speaker.
- During firmware playback, disable or ignore microphone input until the speaker output and room echo have stopped.
