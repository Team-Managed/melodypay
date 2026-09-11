import { describe, expect, it } from "vitest";
import {
  MAX_CHUNK_PAYLOAD,
  MessageType,
  assembleFrames,
  decodePaymentRequest,
  encodePaymentRequest,
  type PaymentRequest,
} from "../receiver-web/src/core/payment-protocol";

const request: PaymentRequest = {
  requestId: 0x12345678,
  audioProfile: 2,
  chainId: 10143n,
  assetType: "native",
  tokenAddress: "0x0000000000000000000000000000000000000000",
  recipient: "0x1111111111111111111111111111111111111111",
  value: 10000000000000000n,
  nonce: 7n,
  gasLimit: 21000,
  maxPriorityFeePerGas: 2000000000n,
  maxFeePerGas: 150000000000n,
  ttlSeconds: 60,
};

describe("payment protocol", () => {
  it("encodes a payment request into bounded checksummed frames", () => {
    const frames = encodePaymentRequest(request, 0x42);

    expect(frames.length).toBeGreaterThan(1);
    expect(frames.every((frame) => frame.length <= MAX_CHUNK_PAYLOAD + 8)).toBe(true);
    expect(frames[0][0]).toBe(0x4d);
  });

  it("round trips a payment request after frame reordering", () => {
    const frames = encodePaymentRequest(request, 0x42);
    const decoded = decodePaymentRequest(assembleFrames([...frames].reverse()));

    expect(decoded.messageType).toBe(MessageType.PaymentRequest);
    expect(decoded.request).toEqual(request);
  });

  it("rejects a frame with a modified payload", () => {
    const frames = encodePaymentRequest(request, 0x42);
    const corrupted = frames.map((frame) => new Uint8Array(frame));
    corrupted[0][corrupted[0].length - 1] ^= 0xff;

    expect(() => assembleFrames(corrupted)).toThrow(/CRC|checksum/i);
  });
});
