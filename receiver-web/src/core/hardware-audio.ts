import {
  createHardwareGGWaveSession,
  type HardwareGGWaveSession,
} from "./ggwave";
import {
  packHardwarePayload,
  unpackHardwarePayload,
  type HardwarePayload,
} from "./hardware-ggwave-frame";

const HARDWARE_SAMPLE_RATE = 48000;

function closeAudioContext(audioContext: AudioContext | null) {
  if (audioContext && audioContext.state !== "closed") {
    void audioContext.close();
  }
}

export async function playHardwarePayload(text: string): Promise<void> {
  const audioContext = new AudioContext({ sampleRate: HARDWARE_SAMPLE_RATE });
  let session: HardwareGGWaveSession | null = null;
  try {
    if (audioContext.state === "suspended") await audioContext.resume();
    session = await createHardwareGGWaveSession(audioContext.sampleRate, audioContext.sampleRate);
    const { frame } = packHardwarePayload(text);
    const samples = session.encode(frame);
    const buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate);
    buffer.getChannelData(0).set(samples);

    await new Promise<void>((resolve, reject) => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        source.disconnect();
        resolve();
      };
      try {
        source.start();
      } catch (error) {
        source.disconnect();
        reject(error);
      }
    });
  } finally {
    session?.dispose();
    closeAudioContext(audioContext);
  }
}

export async function playHardwareChunkedPayload(text: string, gapMs = 300): Promise<void> {
  const chunkSize = 48;
  const total = Math.max(1, Math.ceil(text.length / chunkSize));
  const chunks = Array.from({ length: total }, (_, index) => text.slice(index * chunkSize, (index + 1) * chunkSize));
  for (let index = 0; index < chunks.length; index += 1) {
    await playHardwarePayload(`REQ${index + 1}/${chunks.length}|${chunks[index]}`);
    if (index < chunks.length - 1) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
}

export async function startHardwareListening(
  onPayload: (payload: HardwarePayload) => void,
  deliverOnce = true,
): Promise<{ stop: () => void }> {
  const audioContext = new AudioContext({ sampleRate: HARDWARE_SAMPLE_RATE });
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let muteNode: GainNode | null = null;
  let session: HardwareGGWaveSession | null = null;
  let stopped = false;
  let delivered = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    processor?.disconnect();
    source?.disconnect();
    muteNode?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    session?.dispose();
    closeAudioContext(audioContext);
  };

  try {
    if (audioContext.state === "suspended") await audioContext.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    session = await createHardwareGGWaveSession(audioContext.sampleRate, audioContext.sampleRate);
    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    muteNode = audioContext.createGain();
    muteNode.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (stopped || (delivered && deliverOnce) || !session) return;
      const frame = session.decode(event.inputBuffer.getChannelData(0));
      if (!frame) return;
      const payload = unpackHardwarePayload(frame);
      if (!payload) return;
      if (deliverOnce) delivered = true;
      onPayload(payload);
    };

    source.connect(processor);
    processor.connect(muteNode);
    muteNode.connect(audioContext.destination);
    return { stop };
  } catch (error) {
    stop();
    throw error;
  }
}

export async function startHardwareChunkedListening(
  onComplete: (payload: string) => void,
  onStatus?: (message: string) => void,
): Promise<{ stop: () => void }> {
  const chunks = new Map<number, string>();
  let expectedTotal = 0;
  return startHardwareListening((decoded) => {
    const match = decoded.text.match(/^(TX|AUTH)(\d+)\/(\d+)\|(.*)$/);
    if (!match) {
      onComplete(decoded.text);
      return;
    }
    const index = Number(match[2]);
    const total = Number(match[3]);
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || index > total || total > 16) return;
    if (expectedTotal !== 0 && expectedTotal !== total) chunks.clear();
    expectedTotal = total;
    chunks.set(index, match[4]);
    onStatus?.(`Received transaction chunk ${chunks.size}/${total}`);
    if (chunks.size !== total || !Array.from({ length: total }, (_, offset) => chunks.has(offset + 1)).every(Boolean)) return;
    onComplete(Array.from({ length: total }, (_, offset) => chunks.get(offset + 1) ?? "").join(""));
    chunks.clear();
    expectedTotal = 0;
  }, false);
}
