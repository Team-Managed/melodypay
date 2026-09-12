import { describe, expect, it } from "vitest";
import {
  HARDWARE_FRAME_BYTES,
  MAX_HARDWARE_PAYLOAD_BYTES,
  packHardwarePayload,
  unpackHardwarePayload,
} from "../receiver-web/src/core/hardware-ggwave-frame";

describe("hardware ggwave frame", () => {
  it("packs UTF-8 text with a byte length prefix and zero padding", () => {
    const result = packHardwarePayload("pay €");

    expect(result.payloadBytes).toEqual(new TextEncoder().encode("pay €"));
    expect(result.frame.length).toBe(HARDWARE_FRAME_BYTES);
    expect(result.frame[0]).toBe(7);
    expect(Array.from(result.frame.slice(8))).toEqual(new Array(56).fill(0));
  });

  it("round trips the maximum UTF-8 payload", () => {
    const text = "€".repeat(21);
    const packed = packHardwarePayload(text);

    expect(packed.payloadBytes.length).toBe(MAX_HARDWARE_PAYLOAD_BYTES);
    expect(unpackHardwarePayload(packed.frame)).toEqual({
      text,
      payloadBytes: packed.payloadBytes,
    });
  });

  it("rejects payloads larger than 63 UTF-8 bytes", () => {
    expect(() => packHardwarePayload("€".repeat(22))).toThrow(/63 bytes/);
  });

  it("rejects invalid fixed frames", () => {
    expect(unpackHardwarePayload(new Uint8Array(63))).toBeNull();

    const invalidLength = new Uint8Array(HARDWARE_FRAME_BYTES);
    invalidLength[0] = 64;
    expect(unpackHardwarePayload(invalidLength)).toBeNull();

    const invalidUtf8 = new Uint8Array(HARDWARE_FRAME_BYTES);
    invalidUtf8[0] = 1;
    invalidUtf8[1] = 0xff;
    expect(unpackHardwarePayload(invalidUtf8)).toBeNull();
  });
});
