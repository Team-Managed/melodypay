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

export { SAMPLE_RATE };
