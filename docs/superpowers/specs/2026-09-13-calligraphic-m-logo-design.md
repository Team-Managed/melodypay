# Calligraphic 'M' Stave Logo Design Specification

## Overview
Design and implement the official brand logo mark for MelodyPay: a luminous, calligraphic "M" constructed from a 3-line musical stave and acoustic wave ribbon with a traveling radiant pulse, matching the aesthetic and mathematical architecture of [PayForSoundStaffRibbon.tsx](file:///c:/Users/Tyra/melodypay/receiver-web/src/components/PayForSoundStaffRibbon.tsx).

## Visual Characteristics & Identity
1. **Spencerian Calligraphic Wave Silhouette**:
   - Continuous parametric path forming an "M":
     - Lower-left entrance flourish ($X \approx 14, Y \approx 72$)
     - First resonant arch / crest ($X \approx 36, Y \approx 24$)
     - Central harmonic valley dip ($X \approx 62, Y \approx 64$)
     - Second resonant arch / crest ($X \approx 82, Y \approx 24$)
     - Outgoing acoustic wave tail flourish ($X \approx 98, Y \approx 74$)
   - Gentle curvature radii ($R > 18$) along all arches to prevent normal-vector pinching or self-intersection.

2. **3-Line Acoustic Stave**:
   - 3 equidistant parallel lines representing the acoustic harmonics (fundamental, 1st overtone, 2nd overtone).
   - Offset along curve normal vectors:
     - Inner Line: offset $-d$
     - Center Line: offset $0$
     - Outer Line: offset $+d$
   - Spacing scaled to component size ($d \approx 3.2$ in $100\times 100$ coordinate space).

3. **Luminous Radiant Bloom**:
   - Base strokes: Solid crisp white (`#FFFFFF`) with soft ambient white bloom (`shadowBlur: 6`).
   - Contrast drop-shadow for visibility on both dark glassmorphism headers and bright backgrounds.
   - Traveling wave pulse: A bright, glowing wave front moving continuously across the 3 lines from start to end (~3.5s period).

## Component Architecture
- **File**: `receiver-web/src/components/MelodyLogoM.tsx`
- **Props**:
  ```typescript
  export interface MelodyLogoMProps {
      size?: number; // Width and height in px, default 28
      className?: string;
      animated?: boolean; // Enable/disable canvas traveling pulse, default true
  }
  ```
- **Performance Invariant**:
  - Exact same architecture as `PayForSoundStaffRibbon`:
  - Normalized path sampled into 200 discrete points and unit normal vectors once on mount.
  - Zero DOM allocations or `getPointAtLength` queries inside the `requestAnimationFrame` loop.
  - DPR scaling (`window.devicePixelRatio`) with high-DPI canvas backing store for razor-sharp rendering on Retina displays.

## Studio Header Integration
- Embedded in `StudioHeader.tsx` inside the primary brand anchor:
  ```tsx
  <Link to="/" className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setMobileOpen(false)}>
      <MelodyLogoM size={26} />
      <span className="text-sm font-semibold tracking-tight text-white font-sans">
          MelodyPay
      </span>
  </Link>
  ```

## Verification & Testing
1. **Unit Test Suite**: Add tests in `tests/ui-components.test.ts` verifying path sample normalization, 3-line normal bounds, and dimension scaling.
2. **Visual Inspection**: Use browser testing to verify razor-sharp rendering at 26px in `StudioHeader` and responsiveness on mobile.
