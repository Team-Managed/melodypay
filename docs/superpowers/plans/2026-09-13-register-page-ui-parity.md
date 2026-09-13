# Register Page UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/register` visually in line with `feat/ui-ux` while preserving the current email-free Base/USDC prebooking behavior.

**Architecture:** Keep `Register.tsx` as the single route component. Preserve its existing wallet, network, allowance, queue, and prebooking handlers while replacing the sparse JSX with the branch-inspired meadow, editorial, glass-card, allocation, and status composition. Do not reintroduce the branch email or receipt modules.

**Tech Stack:** React 18, TypeScript, React Router, Framer Motion, Tailwind CSS, ethers v6, Vite, Vitest.

## Global Constraints

- The page remains an email-free Base Mainnet hardware prebooking flow.
- Preserve the current wallet connection, Base network switching, USDC approval, prebooking contract call, queue reads, and transaction explorer link.
- Do not copy the branch's email or receipt implementation.
- Do not modify `/receive`, `/audio-test`, ENS resolution, Arc settlement, or hardware audio behavior.
- Desktop uses two columns; mobile/tablet collapses to one column with natural scrolling.
- No client source may reference Brevo, Resend, `/api/send-email`, or `VITE_RESEND_API_KEY`.

---

### Task 1: Port Register Visual Composition

**Files:**
- Modify: `receiver-web/src/pages/Register.tsx:206-288`
- Reference: `docs/superpowers/specs/2026-09-13-register-page-ui-parity-design.md`
- Reference: `origin/feat/ui-ux:receiver-web/src/pages/Register.tsx`

**Interfaces:**
- Consumes: existing `wallet`, `chainId`, `quantity`, `queueCount`, `units`, `balance`, `status`, `error`, `txHash`, `busy`, and transaction handlers in `Register.tsx`.
- Produces: the same route and handler behavior with branch-matching visual regions.

- [ ] **Step 1: Preserve the current behavioral code**

Keep `configuredContractAddress`, `refreshWalletState`, `connectWallet`, `switchToBase`, `handlePrebook`, and the wallet event listener unchanged. Do not add an email input, email state, email import, or email request.

- [ ] **Step 2: Build the page atmosphere and header-safe shell**

Use the existing meadow asset and full-height shell:

```tsx
<motion.div className="relative isolate min-h-screen overflow-hidden px-4 pb-10 pt-28 text-white sm:px-6 sm:pt-32 lg:px-10 lg:pb-12 lg:pt-28">
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0d281a]">
    <img src="/image copy 2.png" alt="" className="h-full w-full scale-105 object-cover object-center opacity-70" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#0d281a]/35 to-black/70" />
  </div>
  <div className="relative z-10 mx-auto grid w-full max-w-[1380px] gap-5 lg:grid-cols-2 lg:gap-7">
    {/* form and allocation cards */}
  </div>
</motion.div>
```

- [ ] **Step 3: Expand the form card to match the branch hierarchy**

Inside the left glass card, add the branch-style eyebrow and title, back link, wallet status bar, quantity/pricing card, and status/error regions. Keep the action states exactly mapped to existing behavior:

```tsx
{!wallet ? <ConnectButton /> : !isBase ? <SwitchNetworkButton /> : <PrebookButton />}
{error && <ErrorNotice>{error}</ErrorNotice>}
{status && <StatusNotice>{status}</StatusNotice>}
{txHash && <BaseScanLink hash={txHash} />}
```

The copy must make the on-chain transaction hash the confirmation source; do not imply an email will be sent.

- [ ] **Step 4: Add the allocation/specification card**

Add a right-hand glass card with the branch visual treatment and static product information for:

- Direct USDC settlement on Base Mainnet.
- ESP32-S3 hardware with physical transaction approval.
- Air-gapped acoustic operation.
- Queue number, current wallet units, USDC balance, and contract configuration.

Use the existing state values for live metadata. Keep this panel informational and free of new network calls.

- [ ] **Step 5: Verify responsive behavior locally**

Check that `lg:grid-cols-2` is the only desktop split, that the right card follows the form card below `lg`, and that no fixed-height container clips controls or status messages.

### Task 2: Verify Behavioral Boundaries

**Files:**
- Test: `tests/*.test.ts`
- Inspect: `receiver-web/src/**/*.ts`, `receiver-web/src/**/*.tsx`

**Interfaces:**
- Consumes: the updated register page and existing test suite.
- Produces: verified UI parity without behavior regressions or email exposure.

- [ ] **Step 1: Confirm email remains absent from client source**

Run:

```bash
rg -n "BREVO|RESEND|sendinblue|resend\\.com|/api/send-email|VITE_RESEND_API_KEY" receiver-web/src
```

Expected: no matches.

- [ ] **Step 2: Run the protocol and integration tests**

Run `npm test`. Expected: all existing test files and 24 tests pass.

- [ ] **Step 3: Run the production typecheck and build**

Run `npm run build`. Expected: TypeScript and Vite build complete successfully. The existing large-chunk warning is acceptable unless it becomes an error.

- [ ] **Step 4: Check the final diff**

Run `git diff --check` and inspect that only the register UI and the plan/spec documentation changed.

### Task 3: Commit and Push

**Files:**
- Commit: `receiver-web/src/pages/Register.tsx` and any explicitly required register UI files.
- Commit: `docs/superpowers/plans/2026-09-13-register-page-ui-parity.md` if it is not already committed.

**Interfaces:**
- Consumes: verified implementation from Tasks 1-2.
- Produces: a pushed `main` commit available for testing.

- [ ] **Step 1: Review status and staged paths**

Run `git status --short --branch` and ensure `.env` and `contracts/lib/contracts-v2` are not staged.

- [ ] **Step 2: Commit with the repository style**

Use a concise message such as:

```bash
git add receiver-web/src/pages/Register.tsx
git commit -m "feat: match register page ui design"
```

- [ ] **Step 3: Push `main`**

Run `git push origin main` and verify `git ls-remote origin refs/heads/main` resolves to the new commit.
