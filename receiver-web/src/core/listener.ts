import {
  decode,
  getGGWaveSampleRate,
  initGGWave,
  isInitialized,
  SAMPLE_RATE,
} from "./ggwave";

export type OnDecodeCallback = (data: string) => void;
export type AudioStreamListener = (source: MediaStreamAudioSourceNode, ctx: AudioContext) => void;

let activeSource: MediaStreamAudioSourceNode | null = null;
let activeAudioCtx: AudioContext | null = null;
let activeProcessor: ScriptProcessorNode | null = null;
let activeStream: MediaStream | null = null;
let activePreamp: GainNode | null = null;
const streamSubscribers = new Set<AudioStreamListener>();
let activeDecodeCallback: OnDecodeCallback | null = null;

/**
 * Subscribe to the live microphone audio stream used by the listener.
 * Allows visualizers like AcousticOscilloscope to display the live waveform without duplicate mic requests.
 */
export function subscribeAudioStream(callback: AudioStreamListener): () => void {
  streamSubscribers.add(callback);
  if (activeSource && activeAudioCtx) {
    try {
      callback(activeSource, activeAudioCtx);
    } catch {}
  }
  return () => {
    streamSubscribers.delete(callback);
  };
}

/**
 * Feed a simulated or acoustic loopback payload into the active listening pipeline.
 */
export function triggerSimulatedAudioPayload(payload: string): void {
  if (activeDecodeCallback) {
    activeDecodeCallback(payload);
  }
}

/**
 * Start listening on the microphone for ggwave-encoded data.
 */
export async function startListening(
  onDecode: OnDecodeCallback,
): Promise<{ stop: () => void }> {
  activeDecodeCallback = onDecode;

  // Clean up any existing processor or stream
  if (activeProcessor) {
    try { activeProcessor.disconnect(); } catch {}
    activeProcessor = null;
  }
  if (activePreamp) {
    try { activePreamp.disconnect(); } catch {}
    activePreamp = null;
  }
  if (activeSource) {
    try { activeSource.disconnect(); } catch {}
    activeSource = null;
  }
  if (activeStream) {
    try { activeStream.getTracks().forEach((t) => t.stop()); } catch {}
    activeStream = null;
  }

  // Create or reuse AudioContext with hardware native sample rate
  let audioCtx = activeAudioCtx;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
    activeAudioCtx = audioCtx;
  }

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  // Dynamically initialize/reconfigure ggwave to match AudioContext sample rate
  await initGGWave(audioCtx.sampleRate);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  activeStream = stream;
  const source = audioCtx.createMediaStreamSource(stream);
  activeSource = source;

  // Broadcast stream to subscribed visualizers (AcousticOscilloscope)
  streamSubscribers.forEach((cb) => {
    try {
      cb(source, audioCtx!);
    } catch {}
  });

  // Preamp Gain Node (2.5x software boost for acoustic transmissions over air)
  const preamp = audioCtx.createGain();
  preamp.gain.value = 2.5;
  activePreamp = preamp;

  // Buffer size 1024 matches ggwave's default samplesPerFrame (1024)
  const bufferSize = 1024;
  const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
  activeProcessor = processor; // Store persistently to prevent V8 garbage collection

  let frameCount = 0;
  processor.onaudioprocess = (event) => {
    // Mute output buffer to prevent acoustic speaker feedback
    const output = event.outputBuffer.getChannelData(0);
    output.fill(0);

    const samples = event.inputBuffer.getChannelData(0);

    // Periodic health log every ~1.5s
    if (++frameCount % 60 === 0) {
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / samples.length);
      const db = Math.round(20 * Math.log10(Math.max(rms, 1e-4)));
      console.log(`[MelodyPay Mic] Active | Rate: ${audioCtx!.sampleRate} Hz | Level: ${db} dB`);
    }

    const result = decode(new Float32Array(samples));
    if (result && result.trim().length > 0) {
      console.log("[MelodyPay Listener] DECODED ACOUSTIC PACKET:", result.trim());
      onDecode(result.trim());
    }
  };

  source.connect(preamp);
  preamp.connect(processor);
  processor.connect(audioCtx.destination);

  console.log(`[MelodyPay Listener] Started listening on microphone at ${audioCtx.sampleRate} Hz`);

  return {
    stop: () => {
      console.log("[MelodyPay Listener] Stopping microphone listener...");
      if (activeDecodeCallback === onDecode) {
        activeDecodeCallback = null;
      }
      if (activeProcessor) {
        try { activeProcessor.disconnect(); } catch {}
        activeProcessor = null;
      }
      if (activePreamp) {
        try { activePreamp.disconnect(); } catch {}
        activePreamp = null;
      }
      if (activeSource) {
        try { activeSource.disconnect(); } catch {}
        activeSource = null;
      }
      if (activeStream) {
        try { activeStream.getTracks().forEach((t) => t.stop()); } catch {}
        activeStream = null;
      }
    },
  };
}

/**
 * Listen for chunked transmissions (TX1/N|data, TX2/N|data, ...).
 * Reassembles all chunks and calls onComplete with the full payload.
 * Also passes through non-chunked messages via onDecode.
 */
export async function startChunkedListening(
  onComplete: (fullPayload: string) => void,
  onStatus?: (msg: string) => void,
): Promise<{ stop: () => void }> {
  const chunks = new Map<number, string>();
  let expectedTotal = 0;

  return startListening((data) => {
    // Check if this is a chunked message: TX<n>/<total>|<data>
    const match = data.match(/^TX(\d+)\/(\d+)\|(.*)$/);
    if (!match) {
      // Not a chunk — pass through directly (e.g. PAY| messages)
      onComplete(data);
      return;
    }

    const chunkNum = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    const chunkData = match[3];

    if (total < 1 || chunkNum < 1 || chunkNum > total || total > 255) return;
    if (expectedTotal !== 0 && expectedTotal !== total) {
      chunks.clear();
    }

    expectedTotal = total;
    if (chunks.get(chunkNum) === chunkData) return;
    chunks.set(chunkNum, chunkData);

    onStatus?.(`Received chunk ${chunks.size}/${total}`);

    // Check if we have all chunks
    if (chunks.size === total && Array.from({ length: total }, (_, i) => i + 1).every((i) => chunks.has(i))) {
      // Reassemble in order
      let fullPayload = "";
      for (let i = 1; i <= total; i++) {
        fullPayload += chunks.get(i) || "";
      }
      chunks.clear();
      onComplete(fullPayload);
    }
  });
}
