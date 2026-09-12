# Light Mode Editorial Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the MelodyPay frontend into a cohesive, high-contrast Light Mode design following the reference layout: floating dark pill navbar, framed lush meadow artwork centerpiece with "Pay with Sound" musical stave animation overlay, editorial typography split row below (bold headline on the left, description + black pill CTA on the right), and isolated light-mode 3D hardware teardown down-page.

**Architecture:** Maintain keyless client-side security and air-gapped guarantees. Unify the styling across Home (`/`), POS Terminal (`/receive`), and Pre-Booking Registrar (`/register`) under the warm drafting canvas (`#FBFBF9`), crisp carbon text (`#111113`), and 1px architectural borders (`#E2E2DA`). The 3D hardware model is removed from the hero and housed exclusively in `#hardware`.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, GSAP, Three.js, Lucide React.

## Global Constraints

- Never commit unauthorized mocks or suppress type errors with `@ts-ignore` or `any`.
- Never weaken `tsconfig.json` or linter configurations.
- Retain all 30/30 existing unit tests and ensure clean TypeScript build with `npm test` and `npm run build`.
- No breadboard model in the hero section.

---

### Task 1: Update Floating Dark Pill Navbar (`StudioHeader.tsx`)

**Files:**
- Modify: `receiver-web/src/components/StudioHeader.tsx`
- Test: `tests/ui-components.test.ts`

**Interfaces:**
- Consumes: `react-router-dom` (`Link`, `useLocation`), `lucide-react` (`Sparkles`, `Menu`, `X`)
- Produces: `<StudioHeader />` component exporting the fixed floating dark pill navigation bar.

- [ ] **Step 1: Write the failing test for floating dark pill navbar**

In `tests/ui-components.test.ts`, add test checking that `StudioHeader` renders brand name, nav links, and the white pill CTA button linking to `/receive`.

- [ ] **Step 2: Run test to verify failure / current state**

Run: `npx vitest run tests/ui-components.test.ts`

- [ ] **Step 3: Update `StudioHeader.tsx`**

Ensure `StudioHeader` features:
- Fixed top center floating pill: `fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-4xl`.
- Dark charcoal pill container: `bg-[#111113] border border-neutral-800 rounded-full px-5 py-2 sm:py-2.5 shadow-2xl flex items-center justify-between text-white`.
- Left: Sparkles icon + `MelodyPay` + green live pulse badge `ARC USDC`.
- Center: Nav links (`Terminal`, `Register`, `Hardware`, `Oscilloscope`, `Ecosystem`).
- Right: White pill button `Launch Terminal` linking to `/receive` (`bg-white text-black font-semibold rounded-full px-4 py-1.5 text-xs hover:bg-neutral-200 transition-all shadow-sm`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui-components.test.ts`
Expected: PASS

---

### Task 2: Adapt `PayForSoundStaffRibbon.tsx` for Centerpiece Hero Overlay

**Files:**
- Modify: `receiver-web/src/components/PayForSoundStaffRibbon.tsx`

**Interfaces:**
- Consumes: Canvas 2D WebAudio context, `CURSIVE_PAYWITHSOUND_PATH`
- Produces: `<PayForSoundStaffRibbon isOverlay?: boolean className?: string />`

- [ ] **Step 1: Inspect `PayForSoundStaffRibbon.tsx` container & styling**

Add optional `isOverlay?: boolean` prop:
When `isOverlay` is true, remove any background card styling, rendering transparently so the canvas sits cleanly over the centerpiece image (`public/image copy 2.png`), with discreet floating audio controls in the bottom-right corner.

- [ ] **Step 2: Verify component builds cleanly**

Run: `npm run build`
Expected: PASS

---

### Task 3: Overhaul Landing Page (`Home.tsx`) to Editorial Light Mode Layout

**Files:**
- Modify: `receiver-web/src/pages/Home.tsx`
- Modify: `receiver-web/src/components/HardwareTeardown.tsx`
- Test: `tests/ui-components.test.ts`

**Interfaces:**
- Consumes: `PayForSoundStaffRibbon`, `AcousticOscilloscope`, `HardwareTeardown`, `MelodyPayStaffRibbon`
- Produces: `<Home />` page matching the reference layout in warm drafting light mode.

- [ ] **Step 1: Write test for Home editorial layout structure**

In `tests/ui-components.test.ts`, add test asserting that Home renders:
- Hero centerpiece frame with `image copy 2.png` and `PayForSoundStaffRibbon`.
- Editorial headline `Pay with sound.` and `Air-gapped on Arc & Monad.`.
- `Launch Terminal` CTA button linking to `/receive`.
- Dedicated Hardware Teardown section `#hardware` without breadboard in the hero.

- [ ] **Step 2: Update `Home.tsx`**

1. Base styling: `w-full min-h-screen bg-[#FBFBF9] text-[#111113] relative overflow-hidden font-sans`.
2. Hero section:
   - Centerpiece frame: `max-w-6xl mx-auto h-[380px] sm:h-[480px] lg:h-[540px] rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E2E2DA] shadow-xl relative bg-[#F5F5F0]`.
   - Displays `/image copy 2.png` with `object-cover w-full h-full`.
   - Mounts `<PayForSoundStaffRibbon isOverlay className="absolute inset-0 z-10" />`.
3. Editorial split row directly below:
   - Left: `text-4xl sm:text-5xl lg:text-[3.75rem] font-bold tracking-tight text-[#111113] leading-[1.08]`.
   - Right: Description paragraph + solid black pill button `Launch Terminal` (`bg-[#111113] hover:bg-black text-white px-7 py-3 rounded-full text-sm font-semibold shadow-md flex items-center gap-2 group`) + `Pre-book Device & ENS ➔`.
4. Down-page sections in light drafting mode:
   - Ticker ribbon: `bg-[#F5F5F0] border-y border-[#E2E2DA] text-[#111113]`.
   - Hardware section `#hardware`: `bg-[#FFFFFF] border border-[#E2E2DA]` container with 3D breadboard.
   - Oscilloscope section `#oscilloscope`: clean light bench.
   - Ecosystem section `#ecosystem`: clean white cards (`bg-[#FFFFFF] border-[#E2E2DA] text-[#111113]`).
   - Turn-taking timeline & footer: warm drafting light styling.

- [ ] **Step 3: Update `HardwareTeardown.tsx` viewport for light theme**

Update 3D viewport background in `HardwareTeardown.tsx` from dark gradient `from-[#050508]` to clean studio drafting bench `bg-[#F5F5F0] border border-[#E2E2DA]`, and component buttons to clean light styling (`bg-[#FBFBF9] border-[#E2E2DA] text-[#111113]`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui-components.test.ts`
Expected: PASS

---

### Task 4: Full Suite Verification & Build

**Files:**
- Modify: `context/progress-tracker.md`

- [ ] **Step 1: Run full unit test suite**

Run: `npm test`
Expected: All 30/30 tests PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Clean build with 0 TypeScript/lint errors.

- [ ] **Step 3: Update Progress Tracker**

Update `context/progress-tracker.md` to reflect completion of the Light Mode Editorial Revamp.
