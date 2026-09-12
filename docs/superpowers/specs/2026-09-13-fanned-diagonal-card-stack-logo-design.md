# Fanned Diagonal Card Stack Logo Design Specification

## Overview
Design and implement the official brand logo mark for MelodyPay: a fanned diagonal payment card stack featuring an acoustic EMV chip, sound wave ripples, and a Visa-style bold italic **"MP"** payment network mark.

## Design Decisions
Following design exploration, the user selected:
- **Style**: Fanned dynamic stack (two cards fanned at contrasting diagonal angles, creating an open card spread).
- **Back Card**: Tilted at a steeper diagonal angle (~ -24°), offset up-left, peeking out behind with its top edge, top-left corner, and top-right corner.
- **Front Card**: Tilted at a gentler diagonal angle (~ -10°), positioned in front with solid dark matte chassis, crisp high-contrast white border, top-left EMV chip + acoustic contactless wave ripples, and lower-right bold italic "MP" network mark.
- **Static Invariant**: 100% static vector SVG (zero runtime loops, zero CPU overhead, zero animation intervals).
- **Audio Invariant**: Zero audio output (no synthesizers or oscillators).

## Geometry & SVG Coordinates
1. **Coordinate System & ViewBox**:
   - `viewBox="0 0 38 28"`
   - Center pivot: $(X \approx 19, Y \approx 14)$
   - Standard ISO card aspect ratio: $26 \times 16.5$ (1.58:1 ratio) for each card.

2. **Back Card Layer (`rotate(-24deg)`)**:
   - Transform: `transform="translate(16, 12) rotate(-24) translate(-13, -8.25)"`
   - Chassis: `<rect width="26" height="16.5" rx="2.4" fill="#121216" stroke="#FFFFFF" strokeWidth="1.1" opacity="0.6" />`
   - Accent Stripe / Notch: Subtle magnetic or accent stripe peeking out from the top edge.

3. **Front Card Layer (`rotate(-10deg)`)**:
   - Transform: `transform="translate(20, 16) rotate(-10) translate(-13, -8.25)"`
   - Chassis: `<rect width="26" height="16.5" rx="2.4" fill="#16161A" stroke="#FFFFFF" strokeWidth="1.25" />`
   - EMV Acoustic Chip:
     - Position: $(X \approx 3, Y \approx 3.2)$, Dimensions: $5.4 \times 4.2$, `rx="0.9"`
     - Grid lines: horizontal & vertical internal contact lines.
   - Contactless Sound Waves:
     - 2 acoustic concentric arcs `)))` positioned beside the chip ($X \approx 10$ to $12$).
   - Bold Italic "MP" Network Mark:
     - Position: Lower-right ($X \approx 20, Y \approx 13.8$)
     - Font: `fontFamily="system-ui, sans-serif"`, `fontWeight="900"`, `fontStyle="italic"`, `fontSize="5.8"`
     - Fill: High-contrast white (`#FFFFFF`).

## Component Architecture & Header Integration
- **Component**: `receiver-web/src/components/MelodyLogoM.tsx`
- **Default Size**: `size = 20` (scaled to match the cap height of the `MelodyPay` wordmark in `StudioHeader.tsx`).
- **Header**: Embedded cleanly inside `<Link to="/" className="flex items-center gap-2.5 ...">` in `StudioHeader.tsx`.

## Verification Plan
1. **Unit Testing**: Run `npm test` (`vitest run tests/ui-components.test.ts`) to ensure component contract and exports are verified.
2. **Visual Inspection**: Validate via dev server on `http://localhost:5175/` with the browser subagent.
3. **Progress Tracker**: Update `context/progress-tracker.md`.
