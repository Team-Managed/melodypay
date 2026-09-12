/**
 * ggwave wrapper for browser.
 * Uses ggwave WASM to encode/decode data as audio.
 *
 * Key findings from testing:
 * - ggwave.encode() returns Int8Array (raw audio bytes)
 * - ggwave.decode() expects Int8Array input
 * - Protocol must use ggwaveModule.ProtocolId enum objects, NOT raw numbers
 * - For Web Audio playback: reinterpret Int8Array bytes as Float32Array
 * - For mic input: reinterpret Float32Array bytes as Int8Array
 * - Max payload: 140 bytes per transmission
 * - AUDIBLE_FASTEST: ~2.3s for 53 chars, ~5s for 140 chars
 */

let ggwaveModule: any = null;
let ggwaveInstance: any = null;
let initPromise: Promise<void> | null = null;
let configuredSampleRate: number | null = null;

const SAMPLE_RATE = 48000;
const MAX_PAYLOAD_BYTES = 140;
const HARDWARE_FRAME_BYTES = 64;

/**
 * Get the ProtocolId enum object from the ggwave module.
 * Must be called after initGGWave().
 */
function getProtocol(name: string): any {
  if (!ggwaveModule) throw new Error("Call initGGWave() first");
  return ggwaveModule.ProtocolId[name];
}

export async function initGGWave(sampleRate: number = SAMPLE_RATE): Promise<void> {
  // ggwaveInstance can be 0 (valid instance ID), so check for null explicitly
  if (ggwaveInstance !== null) {
    if (configuredSampleRate !== sampleRate) {
      throw new Error(
        `ggwave is configured for ${configuredSampleRate} Hz, not ${sampleRate} Hz`,
      );
    }
    return;
  }

  // Prevent concurrent initialization
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const ggwaveFactory = (window as any).ggwave_factory;
    if (!ggwaveFactory) {
      throw new Error(
        "ggwave not loaded. Make sure ggwave.js is included in index.html",
      );
    }

    ggwaveModule = await ggwaveFactory();
    const parameters = ggwaveModule.getDefaultParameters();
    parameters.sampleRateInp = sampleRate;
    parameters.sampleRateOut = sampleRate;
    ggwaveInstance = ggwaveModule.init(parameters);
    configuredSampleRate = sampleRate;
  })();

  return initPromise;
}

export function isInitialized(): boolean {
  return ggwaveInstance !== null;
}

export function getGGWaveSampleRate(): number {
  return configuredSampleRate ?? SAMPLE_RATE;
}

/**
 * Encode a string payload into audio samples for Web Audio API playback.
 * Returns Float32Array (reinterpreted from the Int8Array that ggwave produces).
 *
 * Default protocol: AUDIBLE_FASTEST (~2.3s for a 53-char payment request)
 */
export function encode(
  payload: string,
  protocolName: string = "GGWAVE_PROTOCOL_AUDIBLE_FASTEST",
  volume: number = 10,
): Float32Array {
  if (ggwaveInstance === null) throw new Error("Call initGGWave() first");

  if (payload.length > MAX_PAYLOAD_BYTES) {
    console.warn(
      `ggwave: payload is ${payload.length} bytes, max is ${MAX_PAYLOAD_BYTES}. Will be truncated.`,
    );
  }

  const protocol = getProtocol(protocolName);
  const waveform = ggwaveModule.encode(
    ggwaveInstance,
    payload,
    protocol,
    volume,
  );

  // waveform is Int8Array. Reinterpret as Float32Array for Web Audio API.
  const buffer = new ArrayBuffer(waveform.byteLength);
  new Int8Array(buffer).set(waveform);
  return new Float32Array(buffer);
}

/**
 * Feed audio samples from the microphone and attempt to decode.
 * Mic provides Float32Array; we reinterpret bytes as Int8Array for ggwave.
 * Returns the decoded string if data found, null otherwise.
 */
export function decode(samples: Float32Array): string | null {
  if (ggwaveInstance === null) throw new Error("Call initGGWave() first");

  // Reinterpret Float32Array bytes as Int8Array (same buffer, different view)
  const buffer = new ArrayBuffer(samples.byteLength);
  new Float32Array(buffer).set(samples);
  const int8 = new Int8Array(buffer);

  const result = ggwaveModule.decode(ggwaveInstance, int8);
  if (result && result.length > 0) {
    return new TextDecoder("utf-8").decode(new Uint8Array(result));
  }
  return null;
}

export interface HardwareGGWaveSession {
  encode(frame: Uint8Array): Float32Array;
  decode(samples: Float32Array): Uint8Array | null;
  dispose(): void;
}

const HARDWARE_PROTOCOL_NAMES = [
  "GGWAVE_PROTOCOL_AUDIBLE_NORMAL",
  "GGWAVE_PROTOCOL_AUDIBLE_FAST",
  "GGWAVE_PROTOCOL_AUDIBLE_FASTEST",
  "GGWAVE_PROTOCOL_ULTRASOUND_NORMAL",
  "GGWAVE_PROTOCOL_ULTRASOUND_FAST",
  "GGWAVE_PROTOCOL_ULTRASOUND_FASTEST",
  "GGWAVE_PROTOCOL_DT_NORMAL",
  "GGWAVE_PROTOCOL_DT_FAST",
  "GGWAVE_PROTOCOL_DT_FASTEST",
  "GGWAVE_PROTOCOL_MT_NORMAL",
  "GGWAVE_PROTOCOL_MT_FAST",
  "GGWAVE_PROTOCOL_MT_FASTEST",
];

function bytesToWaveform(waveform: Int8Array): Float32Array {
  const buffer = new ArrayBuffer(waveform.byteLength);
  new Int8Array(buffer).set(waveform);
  return new Float32Array(buffer);
}

function samplesToBytes(samples: Float32Array): Int8Array {
  return new Int8Array(samples.buffer, samples.byteOffset, samples.byteLength);
}

function frameToString(frame: Uint8Array): string {
  if (frame.length !== HARDWARE_FRAME_BYTES) {
    throw new Error(`Hardware frame must be ${HARDWARE_FRAME_BYTES} bytes`);
  }

  const wireFrame = frame.slice();
  const payloadLength = wireFrame[0];
  wireFrame.fill(0x20, payloadLength + 1);
  return new TextDecoder("utf-8").decode(wireFrame);
}

export async function createHardwareGGWaveSession(
  sampleRateInp: number,
  sampleRateOut: number,
): Promise<HardwareGGWaveSession> {
  const ggwaveFactory = (window as any).ggwave_factory;
  if (!ggwaveFactory) {
    throw new Error("ggwave is unavailable. Make sure ggwave.js is loaded.");
  }

  const module = await ggwaveFactory();
  const parameters = module.getDefaultParameters();
  parameters.payloadLength = HARDWARE_FRAME_BYTES;
  parameters.sampleRateInp = sampleRateInp;
  parameters.sampleRateOut = sampleRateOut;
  parameters.sampleRate = SAMPLE_RATE;
  parameters.samplesPerFrame = 512;
  parameters.sampleFormatInp = module.SampleFormat.GGWAVE_SAMPLE_FORMAT_F32;
  parameters.sampleFormatOut = module.SampleFormat.GGWAVE_SAMPLE_FORMAT_F32;
  parameters.operatingMode = module.GGWAVE_OPERATING_MODE_RX_AND_TX;

  const audibleFastest = module.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST;
  for (const protocolName of HARDWARE_PROTOCOL_NAMES) {
    const protocol = module.ProtocolId[protocolName];
    if (protocol !== undefined) {
      module.rxToggleProtocol(protocol, 0);
      module.txToggleProtocol(protocol, 0);
    }
  }
  module.rxToggleProtocol(audibleFastest, 1);
  module.txToggleProtocol(audibleFastest, 1);

  const instance = module.init(parameters);
  if (instance < 0) {
    throw new Error("Could not initialize the hardware ggwave profile.");
  }

  let disposed = false;
  return {
    encode(frame) {
      if (disposed) throw new Error("Hardware ggwave session is closed");
      const waveform = module.encode(instance, frameToString(frame), audibleFastest, 25);
      return bytesToWaveform(waveform);
    },
    decode(samples) {
      if (disposed) return null;
      const result = module.decode(instance, samplesToBytes(samples));
      if (!result || result.length !== HARDWARE_FRAME_BYTES) return null;
      return new Uint8Array(result).slice();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      module.free(instance);
    },
  };
}

export { SAMPLE_RATE };
