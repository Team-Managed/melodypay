import { getAddress, getBytes, isAddress } from "ethers";

export const PROTOCOL_MAGIC = 0x4d;
export const PROTOCOL_VERSION = 0x01;
export const CHUNK_HEADER_SIZE = 8;
export const MAX_CHUNK_PAYLOAD = 128;
export const MAX_MESSAGE_SIZE = 1024;

export enum MessageType {
  Hello = 0x01,
  PaymentRequest = 0x02,
  SignedTransaction = 0x03,
  Receipt = 0x04,
  Rejected = 0x05,
  Error = 0x06,
}

export type AudioProfile = 2 | 5;
export type AssetType = "native" | "erc20";

export interface PaymentRequest {
  requestId: number;
  audioProfile: AudioProfile;
  chainId: bigint;
  assetType: AssetType;
  tokenAddress: string;
  recipient: string;
  value: bigint;
  nonce: bigint;
  gasLimit: number;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  ttlSeconds: number;
}

export interface AssembledMessage {
  messageId: number;
  totalChunks: number;
  messageType: MessageType;
  body: Uint8Array;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function writeUint(value: bigint, byteLength: number): Uint8Array {
  const max = 1n << BigInt(byteLength * 8);
  if (value < 0n || value >= max) {
    throw new Error(`Integer does not fit in ${byteLength} bytes`);
  }

  const result = new Uint8Array(byteLength);
  let remaining = value;
  for (let index = byteLength - 1; index >= 0; index -= 1) {
    result[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return result;
}

function readUint(bytes: Uint8Array, offset: number, byteLength: number): bigint {
  if (offset < 0 || offset + byteLength > bytes.length) {
    throw new Error("Integer extends beyond message boundary");
  }

  let result = 0n;
  for (let index = offset; index < offset + byteLength; index += 1) {
    result = (result << 8n) | BigInt(bytes[index]);
  }
  return result;
}

function readNumber(bytes: Uint8Array, offset: number, byteLength: number): number {
  const value = readUint(bytes, offset, byteLength);
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error("Integer cannot be represented safely as a number");
  }
  return result;
}

function addressBytes(address: string): Uint8Array {
  if (!isAddress(address)) throw new Error(`Invalid EVM address: ${address}`);
  return getBytes(getAddress(address));
}

function addressFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 20) throw new Error("EVM address must be 20 bytes");
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return getAddress(`0x${hex}`);
}

/** CRC-8 with polynomial 0x07, initial value 0, and no final XOR. */
export function crc8(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function encodeEnvelope(type: MessageType, body: Uint8Array): Uint8Array {
  if (body.length > 0xffff) throw new Error("Message body is too large");
  return concatBytes(new Uint8Array([type]), writeUint(BigInt(body.length), 2), body);
}

export function encodeMessage(
  type: MessageType,
  body: Uint8Array,
  messageId: number,
): Uint8Array[] {
  if (!Number.isInteger(messageId) || messageId < 0 || messageId > 0xffff) {
    throw new Error("Message ID must fit in uint16");
  }

  const payload = encodeEnvelope(type, body);
  if (payload.length > MAX_MESSAGE_SIZE) throw new Error("Message exceeds maximum size");

  const totalChunks = Math.ceil(payload.length / MAX_CHUNK_PAYLOAD);
  if (totalChunks === 0 || totalChunks > 0xff) throw new Error("Invalid chunk count");

  return Array.from({ length: totalChunks }, (_, chunkIndex) => {
    const chunkPayload = payload.slice(
      chunkIndex * MAX_CHUNK_PAYLOAD,
      (chunkIndex + 1) * MAX_CHUNK_PAYLOAD,
    );
    const frame = new Uint8Array(CHUNK_HEADER_SIZE + chunkPayload.length);
    frame.set(
      [
        PROTOCOL_MAGIC,
        PROTOCOL_VERSION,
        (messageId >>> 8) & 0xff,
        messageId & 0xff,
        chunkIndex,
        totalChunks,
        chunkPayload.length,
        0,
      ],
      0,
    );
    frame.set(chunkPayload, CHUNK_HEADER_SIZE);
    frame[7] = crc8(concatBytes(frame.slice(0, 7), chunkPayload));
    return frame;
  });
}

function validateFrame(frame: Uint8Array): {
  messageId: number;
  chunkIndex: number;
  totalChunks: number;
  payload: Uint8Array;
} {
  if (frame.length < CHUNK_HEADER_SIZE) throw new Error("Frame is shorter than its header");
  if (frame[0] !== PROTOCOL_MAGIC) throw new Error("Invalid protocol magic");
  if (frame[1] !== PROTOCOL_VERSION) throw new Error("Unsupported protocol version");

  const messageId = (frame[2] << 8) | frame[3];
  const chunkIndex = frame[4];
  const totalChunks = frame[5];
  const payloadLength = frame[6];
  const payload = frame.slice(CHUNK_HEADER_SIZE);

  if (totalChunks === 0 || chunkIndex >= totalChunks) throw new Error("Invalid chunk sequence");
  if (payloadLength !== payload.length || payloadLength > MAX_CHUNK_PAYLOAD) {
    throw new Error("Invalid chunk payload length");
  }

  const expectedCrc = crc8(concatBytes(frame.slice(0, 7), payload));
  if (frame[7] !== expectedCrc) throw new Error("Frame CRC checksum mismatch");

  return { messageId, chunkIndex, totalChunks, payload };
}

export function assembleFrames(frames: Uint8Array[]): AssembledMessage {
  if (frames.length === 0) throw new Error("No frames supplied");

  const decoded = frames.map(validateFrame);
  const first = decoded[0];
  const chunks = new Map<number, Uint8Array>();

  for (const frame of decoded) {
    if (frame.messageId !== first.messageId || frame.totalChunks !== first.totalChunks) {
      throw new Error("Frames belong to different messages");
    }
    if (chunks.has(frame.chunkIndex)) throw new Error("Duplicate message chunk");
    chunks.set(frame.chunkIndex, frame.payload);
  }

  if (chunks.size !== first.totalChunks) throw new Error("Message is missing chunks");

  const payload = concatBytes(
    ...Array.from({ length: first.totalChunks }, (_, index) => chunks.get(index)!),
  );
  if (payload.length < 3) throw new Error("Message envelope is incomplete");

  const messageType = payload[0] as MessageType;
  const bodyLength = readNumber(payload, 1, 2);
  if (bodyLength !== payload.length - 3) throw new Error("Message body length mismatch");

  return {
    messageId: first.messageId,
    totalChunks: first.totalChunks,
    messageType,
    body: payload.slice(3),
  };
}

export function encodePaymentRequest(request: PaymentRequest, messageId: number): Uint8Array[] {
  if (request.audioProfile !== 2 && request.audioProfile !== 5) {
    throw new Error("Unsupported audio profile");
  }
  if (request.assetType === "native" && request.tokenAddress !== "0x0000000000000000000000000000000000000000") {
    throw new Error("Native payment requests must use a zero token address");
  }

  const body = concatBytes(
    writeUint(BigInt(request.requestId), 4),
    new Uint8Array([request.audioProfile]),
    writeUint(request.chainId, 8),
    new Uint8Array([request.assetType === "native" ? 0 : 1]),
    addressBytes(request.tokenAddress),
    addressBytes(request.recipient),
    writeUint(request.value, 32),
    writeUint(request.nonce, 8),
    writeUint(BigInt(request.gasLimit), 4),
    writeUint(request.maxPriorityFeePerGas, 32),
    writeUint(request.maxFeePerGas, 32),
    writeUint(BigInt(request.ttlSeconds), 2),
  );

  return encodeMessage(MessageType.PaymentRequest, body, messageId);
}

export function decodePaymentRequest(message: AssembledMessage): {
  messageType: MessageType.PaymentRequest;
  request: PaymentRequest;
} {
  if (message.messageType !== MessageType.PaymentRequest) {
    throw new Error("Expected a payment request message");
  }
  if (message.body.length !== 164) throw new Error("Invalid payment request body length");

  const body = message.body;
  const assetByte = body[13];
  if (assetByte !== 0 && assetByte !== 1) throw new Error("Unsupported asset type");

  return {
    messageType: MessageType.PaymentRequest,
    request: {
      requestId: readNumber(body, 0, 4),
      audioProfile: body[4] as AudioProfile,
      chainId: readUint(body, 5, 8),
      assetType: assetByte === 0 ? "native" : "erc20",
      tokenAddress: addressFromBytes(body.slice(14, 34)),
      recipient: addressFromBytes(body.slice(34, 54)),
      value: readUint(body, 54, 32),
      nonce: readUint(body, 86, 8),
      gasLimit: readNumber(body, 94, 4),
      maxPriorityFeePerGas: readUint(body, 98, 32),
      maxFeePerGas: readUint(body, 130, 32),
      ttlSeconds: readNumber(body, 162, 2),
    },
  };
}
