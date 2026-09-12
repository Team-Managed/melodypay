# ggwave Mobile Audio Test Design

## Status

Approved for implementation.

## Goal

Add a dedicated `/audio-test` page to the MelodyPay web app so a mobile phone can:

- Emit a short text payload over ggwave to the ESP32 hardware.
- Listen for and decode a payload emitted by the ESP32 hardware.
- Display the decoded payload as text and hexadecimal bytes.

The page is a bench diagnostic and must not change the existing `/receive` payment flow.

## Compatibility Contract

The test page uses the current ESP32 transport contract:

- ggwave protocol: `GGWAVE_PROTOCOL_AUDIBLE_FASTEST`.
- Operating sample rate: 48,000 Hz.
- Fixed ggwave payload: 64 bytes.
- Byte zero: UTF-8 payload length.
- Bytes one through 63: UTF-8 payload bytes, zero-padded.
- Maximum text payload: 63 UTF-8 bytes.
- Browser volume: 100 to match the current hardware bench setting.

The existing browser payment path continues using its current variable-length ggwave instance and legacy text framing. The hardware test mode gets a separate ggwave instance/profile rather than changing global defaults.

## Architecture

### ggwave Session Profiles

Extend `receiver-web/src/core/ggwave.ts` with a fixed hardware-test profile alongside the existing legacy profile. Each profile owns its ggwave instance and configured sample-rate metadata. The fixed profile configures:

- `payloadLength = 64`.
- Input and output sample formats compatible with Web Audio buffers.
- RX and TX enabled.
- Only the audible-fastest protocol enabled.
- Operating sample rate fixed at 48 kHz, with browser input/output sample rates passed to ggwave for supported resampling.

Expose profile-scoped encode/decode functions so the page cannot accidentally use the payment profile.

### Audio Test Page

Add `receiver-web/src/pages/AudioTest.tsx` and route it at `/audio-test`. The page uses the existing visual language but is intentionally diagnostic:

- Header with back navigation and a clear `Audio bench` label.
- Emit card with a text input, byte count, and `Emit to hardware` button.
- Listen card with `Start listening` and `Stop listening` controls.
- Status region showing initialization, permission, transmission, listening, decode, and error states.
- Latest decoded payload shown in text and hex.
- Mobile layout uses full-width controls and avoids requiring simultaneous microphone and speaker use.

### Audio Helpers

Add hardware-profile helpers to the existing broadcaster/listener boundaries rather than putting Web Audio details in the page:

- Hardware broadcaster creates/resumes an `AudioContext` from a user gesture, encodes the fixed frame, plays it through a buffer source, and resolves on `onended`.
- Hardware listener requests microphone access with echo cancellation, noise suppression, and automatic gain control disabled; it feeds input frames to the fixed-profile decoder and returns the first valid payload.
- Stopping disconnects nodes, stops tracks, and closes the context.

## Data Flow

### Phone to ESP32

1. User enters text on `/audio-test`.
2. The page UTF-8 encodes it and rejects payloads over 63 bytes.
3. The hardware profile creates a zero-filled 64-byte frame with the length prefix.
4. ggwave encodes the frame using audible-fastest.
5. The phone speaker emits the waveform.
6. The ESP32 fixed-frame decoder extracts the length-prefixed text payload.

### ESP32 to Phone

1. ESP32 emits a fixed 64-byte ggwave frame.
2. The user taps `Start listening` on the phone.
3. The browser disables audio processing features that damage ggwave tones.
4. Microphone PCM frames are passed to the fixed-profile decoder.
5. A valid 64-byte frame is length-checked and UTF-8 decoded.
6. The page shows the text, byte length, and hex representation.

## Mobile Constraints

- Playback and microphone setup must happen after explicit user interaction.
- The implementation must handle browsers that ignore the requested 48 kHz context rate by passing the actual input/output rates into ggwave while retaining 48 kHz as the operating rate.
- The listener must provide a visible stop action and clean up tracks on unmount.
- Errors must explain microphone permission, unsupported browser APIs, unavailable ggwave WASM, and invalid payload size without exposing stack traces to the user.
- The page must work at narrow phone widths and remain usable in standalone PWA mode.

## Testing

- Add unit coverage for fixed-frame packing and unpacking, including UTF-8 byte limits, zero padding, invalid length bytes, and malformed UTF-8 handling.
- Add unit coverage for the hardware-profile payload contract without requiring a browser audio device.
- Run the TypeScript/Vite production build.
- Manually verify on a mobile browser:
  - Emit a payload and observe the ESP32 decoder.
  - Emit from ESP32 and verify phone text and hex output.
  - Deny microphone permission and confirm the actionable error state.
  - Stop listening and confirm the microphone indicator clears.

## Out Of Scope

- Changing payment request or signed-transaction framing.
- Adding wallet signing or transaction submission to the test page.
- Supporting ultrasonic mode.
- Sending payloads larger than one fixed 64-byte ggwave frame.
