import {
  encode,
  getGGWaveSampleRate,
  initGGWave,
  isInitialized,
  SAMPLE_RATE,
} from "./ggwave";

// Reuse a single AudioContext to avoid mobile browser limits
let sharedAudioCtx: AudioContext | null = null;

const MAX_PAYLOAD = 140;

export function splitLegacyPayload(payload: string, maxPayload = MAX_PAYLOAD): string[] {
  if (maxPayload <= 8) throw new Error("Legacy payload limit is too small");

  let totalChunks = 1;
  for (;;) {
    const dataSize = maxPayload - `TX${totalChunks}/${totalChunks}|`.length;
    const nextTotal = Math.max(1, Math.ceil(payload.length / dataSize));
    if (nextTotal === totalChunks) break;
    totalChunks = nextTotal;
  }

  const dataSize = maxPayload - `TX${totalChunks}/${totalChunks}|`.length;
  const chunks: string[] = [];
  for (let offset = 0; offset < payload.length || (payload.length === 0 && offset === 0); offset += dataSize) {
    const index = chunks.length + 1;
    chunks.push(`TX${index}/${totalChunks}|${payload.slice(offset, offset + dataSize)}`);
  }
  return chunks;
}

function getAudioContext(): AudioContext {
  const sampleRate = isInitialized() ? getGGWaveSampleRate() : SAMPLE_RATE;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioContext({ sampleRate });
  }
  return sharedAudioCtx;
}

/**
 * Play a payload as ggwave audio through the device speaker.
 */
export async function playPayload(
  payload: string,
  protocolName?: string,
): Promise<void> {
  const audioCtx = getAudioContext();
  await initGGWave(audioCtx.sampleRate);
  const samples = encode(payload, protocolName);

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const buffer = audioCtx.createBuffer(1, samples.length, audioCtx.sampleRate);
  buffer.getChannelData(0).set(samples);

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 1.5;
  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  return new Promise((resolve) => {
    source.onended = () => {
      resolve();
    };
    source.start();
  });
}

/**
 * Play a large payload by splitting into numbered chunks.
 * Format: "TX1/N|<data>" "TX2/N|<data>" ...
 * Each chunk is played sequentially with a gap between.
 */
export async function playChunkedPayload(
  payload: string,
  gapMs: number = 300,
  protocolName?: string,
  maxPayload: number = 56,
): Promise<void> {
  const chunks = splitLegacyPayload(payload, maxPayload);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    await playPayload(chunk, protocolName);
    if (index < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
}

/**
 * Play a payload on loop with gap between plays. Returns stop function.
 */
export function playLoop(
  payload: string,
  intervalMs: number = 5000,
  protocolName?: string,
): { stop: () => void } {
  let running = true;
  const loop = async () => {
    while (running) {
      await playPayload(payload, protocolName);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };
  loop();
  return {
    stop: () => {
      running = false;
    },
  };
}
