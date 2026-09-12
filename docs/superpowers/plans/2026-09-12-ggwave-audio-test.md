# ggwave Mobile Audio Test Implementation Plan

> **For agentic workers:** Implement this plan inline in the current workspace. Do not create commits; the user requested a local LAN test before pushing.

**Goal:** Add a separate `/audio-test` mobile page that sends and receives the ESP32 fixed 64-byte ggwave test frame without changing `/receive`.

**Architecture:** Keep the existing legacy ggwave singleton and payment audio helpers unchanged. Add an isolated hardware-test ggwave WASM session with a fixed 64-byte length-prefixed payload contract, then expose dedicated browser audio helpers and a focused React page.

**Tech Stack:** React 18, TypeScript, Vite, ggwave WASM, Web Audio API, `getUserMedia`, Vitest, Tailwind CSS, Lucide icons.

## Global Constraints

- Use `GGWAVE_PROTOCOL_AUDIBLE_FASTEST` only.
- Use a fixed 64-byte ggwave payload with byte zero as UTF-8 payload length.
- Accept at most 63 UTF-8 payload bytes.
- Keep the existing `/receive` payment path and legacy variable-length ggwave behavior unchanged.
- Keep browser operating sample rate at 48 kHz and pass actual Web Audio input/output rates for resampling.
- Disable echo cancellation, noise suppression, and automatic gain control for microphone capture.
- Do not commit changes in this implementation pass.

---

### Task 1: Add Fixed-Frame Payload Contract

**Files:**
- Create: `receiver-web/src/core/hardware-ggwave-frame.ts`
- Test: `tests/hardware-ggwave-frame.test.ts`

**Interfaces:**
- Produces `MAX_HARDWARE_PAYLOAD_BYTES = 63`.
- Produces `HARDWARE_FRAME_BYTES = 64`.
- Produces `packHardwarePayload(text: string): { frame: Uint8Array; payloadBytes: Uint8Array }`.
- Produces `unpackHardwarePayload(bytes: Uint8Array): { text: string; payloadBytes: Uint8Array } | null`.

- [ ] **Step 1: Write failing tests**

Cover ASCII packing, UTF-8 byte length rather than JavaScript string length, zero-padding to 64 bytes, rejection over 63 bytes, invalid length bytes, wrong frame size, and malformed UTF-8.

```ts
it("packs UTF-8 text with a byte length prefix", () => {
  const result = packHardwarePayload("pay €");
  expect(result.payloadBytes).toEqual(new TextEncoder().encode("pay €"));
  expect(result.frame.length).toBe(64);
  expect(result.frame[0]).toBe(6);
  expect(Array.from(result.frame.slice(7))).toEqual(new Array(57).fill(0));
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `npm test -- tests/hardware-ggwave-frame.test.ts`.

Expected: FAIL because the frame module does not exist.

- [ ] **Step 3: Implement the pure frame pack/unpack functions**

Use `TextEncoder` and `TextDecoder("utf-8", { fatal: true })`. Require exactly 64 bytes on unpack, require a nonzero length no larger than 63, and ignore zero padding after the payload.

- [ ] **Step 4: Run the focused test and the existing test suite**

Run `npm test -- tests/hardware-ggwave-frame.test.ts` and then `npm test`.

Expected: all tests PASS.

### Task 2: Add Isolated Hardware ggwave Session

**Files:**
- Modify: `receiver-web/src/core/ggwave.ts`
- Test: `tests/hardware-ggwave-frame.test.ts` remains the contract test; no WASM-dependent unit test is required.

**Interfaces:**
- Produces `createHardwareGGWaveSession(sampleRateInp: number, sampleRateOut: number): Promise<HardwareGGWaveSession>`.
- `HardwareGGWaveSession.encode(payload: Uint8Array): Float32Array`.
- `HardwareGGWaveSession.decode(samples: Float32Array): Uint8Array | null`.
- `HardwareGGWaveSession.dispose(): void`.

- [ ] **Step 1: Configure an isolated WASM instance**

Call the existing `window.ggwave_factory` separately for the hardware profile so protocol toggles and fixed payload parameters cannot affect the legacy payment instance. Set `payloadLength = 64`, `sampleRate = 48000`, `sampleRateInp = sampleRateInp`, `sampleRateOut = sampleRateOut`, `sampleFormatInp = F32`, `sampleFormatOut = F32`, and RX/TX mode.

- [ ] **Step 2: Encode and decode fixed frames**

Encode the 64-byte frame as a JavaScript string whose UTF-8 representation is exactly 64 bytes. Use audible-fastest and volume `100`. Convert returned signed byte waveform data to the existing `Float32Array` audio representation. On decode, pass the Float32 byte view to ggwave and return a copied `Uint8Array` only when a 64-byte frame is decoded.

- [ ] **Step 3: Disable the session cleanly**

Call the WASM module’s `free(instance)` during `dispose()` and make disposal idempotent.

### Task 3: Add Hardware Browser Audio Helpers

**Files:**
- Create: `receiver-web/src/core/hardware-audio.ts`

**Interfaces:**
- Produces `playHardwarePayload(text: string): Promise<void>`.
- Produces `startHardwareListening(onPayload: (payload: { text: string; bytes: Uint8Array }) => void): Promise<{ stop: () => void }>`.

- [ ] **Step 1: Implement mobile-safe playback**

Create an `AudioContext` from the button-triggered call, resume it, create the hardware ggwave session using the actual context sample rate, pack the payload, play the generated Float32 samples through a one-channel buffer, and close/dispose on `source.onended` or error.

- [ ] **Step 2: Implement microphone listening**

Create the context at the requested 48 kHz, resume it, call `getUserMedia` with all three processing flags disabled, create a 4096-frame ScriptProcessor, feed each input block to the hardware session, unpack decoded bytes, and call the payload callback once. Route the processor through a zero-gain node so the graph stays active without monitoring microphone audio.

- [ ] **Step 3: Implement stop and error cleanup**

Disconnect nodes, stop all stream tracks, dispose the ggwave session, and close the context. Ensure cleanup is safe after partial initialization.

### Task 4: Add `/audio-test` Page and Route

**Files:**
- Create: `receiver-web/src/pages/AudioTest.tsx`
- Modify: `receiver-web/src/App.tsx`

**Interfaces:**
- Route `/audio-test` renders the page.
- Page state exposes emit text, byte count, transmit status, listen status, decoded text, decoded hex, and actionable errors.

- [ ] **Step 1: Add the route and navigation entry**

Add a `Link` from the navbar and a route wrapped in the existing `PageWrapper`.

- [ ] **Step 2: Build the mobile layout**

Use a narrow full-width card with back navigation, `Audio bench` label, separate Emit and Listen sections, explicit buttons, status text, and decoded result panel. Disable Emit while playing and disable Start Listening while already listening.

- [ ] **Step 3: Wire lifecycle cleanup**

Store the listening stop function in a ref and stop it on page unmount, route changes, or explicit Stop. Reset errors and result state on a new operation.

### Task 5: Verify Locally Without Committing

**Files:**
- Modify only if build or test failures require corrections.

- [ ] **Step 1: Run tests**

Run `npm test`.

Expected: all tests PASS.

- [ ] **Step 2: Run the production build**

Run `npm run build`.

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 3: Start the LAN dev server**

Run `npm run dev -- --host 0.0.0.0`.

Report the machine’s LAN URL and the direct `/audio-test` URL. Do not commit or push these changes until the user completes mobile and ESP32 testing.
