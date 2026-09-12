# Calligraphic 'M' Stave Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an iconic, luminous Spencerian calligraphic "M" logo mark built with a 3-line musical stave and animated acoustic traveling pulse, and integrate it into the MelodyPay studio header.

**Architecture:** A standalone, high-performance canvas component (`MelodyLogoM.tsx`) that precomputes 200 curve samples and normal vectors once on mount, rendering 3 equidistant parallel harmonic lines with high-DPI scaling, radiant white bloom, contrast drop-shadow, and a traveling wave pulse.

**Tech Stack:** React 18, TypeScript, HTML5 Canvas 2D, Vitest.

## Global Constraints
- Zero audio output (completely visual acoustic wire representation).
- No pills or thick borders.
- Precomputed sample points and normals — zero DOM queries or `getPointAtLength` in `requestAnimationFrame`.
- Retina device pixel ratio (`window.devicePixelRatio`) backing store scaling.

---

### Task 1: Implement `MelodyLogoM` Component with Unit Tests

**Files:**
- Create: `receiver-web/src/components/MelodyLogoM.tsx`
- Test: `tests/ui-components.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface MelodyLogoMProps {
      size?: number; // default 26
      className?: string;
      animated?: boolean; // default true
  }
  export function MelodyLogoM(props: MelodyLogoMProps): JSX.Element;
  ```

- [ ] **Step 1: Write failing unit test for `MelodyLogoM` path and normal mechanics**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `MelodyLogoM.tsx`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit Task 1**

---

### Task 2: Integrate `MelodyLogoM` into `StudioHeader.tsx`

**Files:**
- Modify: `receiver-web/src/components/StudioHeader.tsx`

**Interfaces:**
- Consumes: `MelodyLogoM` from `receiver-web/src/components/MelodyLogoM.tsx`

- [ ] **Step 1: Update `StudioHeader.tsx` brand link to render `MelodyLogoM`**
- [ ] **Step 2: Verify desktop and mobile header layout**
- [ ] **Step 3: Commit Task 2**

---

### Task 3: Verification, Browser Inspection, and Progress Tracking

**Files:**
- Modify: `context/progress-tracker.md`

- [ ] **Step 1: Run full test suite (`npm test`) and typecheck (`npx tsc --noEmit`)**
- [ ] **Step 2: Inspect visual rendering via `browser_subagent`**
- [ ] **Step 3: Update `context/progress-tracker.md`**
- [ ] **Step 4: Commit Task 3**
