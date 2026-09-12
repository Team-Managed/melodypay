export const HARDWARE_FRAME_BYTES = 64;
export const MAX_HARDWARE_PAYLOAD_BYTES = HARDWARE_FRAME_BYTES - 1;

const encoder = new TextEncoder();

export interface HardwarePayload {
  text: string;
  payloadBytes: Uint8Array;
}

export function packHardwarePayload(text: string): {
  frame: Uint8Array;
  payloadBytes: Uint8Array;
} {
  const payloadBytes = encoder.encode(text);
  if (payloadBytes.length === 0) {
    throw new Error("Payload must contain at least one UTF-8 byte");
  }
  if (payloadBytes.length > MAX_HARDWARE_PAYLOAD_BYTES) {
    throw new Error(`Payload must be at most ${MAX_HARDWARE_PAYLOAD_BYTES} bytes`);
  }

  const frame = new Uint8Array(HARDWARE_FRAME_BYTES);
  frame[0] = payloadBytes.length;
  frame.set(payloadBytes, 1);
  return { frame, payloadBytes };
}

export function unpackHardwarePayload(bytes: Uint8Array): HardwarePayload | null {
  if (bytes.length !== HARDWARE_FRAME_BYTES) return null;

  const payloadLength = bytes[0];
  if (payloadLength === 0 || payloadLength > MAX_HARDWARE_PAYLOAD_BYTES) return null;

  const payloadBytes = bytes.slice(1, payloadLength + 1);
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes),
      payloadBytes,
    };
  } catch {
    return null;
  }
}
