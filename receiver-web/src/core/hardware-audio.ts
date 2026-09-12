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

export async function startHardwareListening(
  onPayload: (payload: HardwarePayload) => void,
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
      if (stopped || delivered || !session) return;
      const frame = session.decode(event.inputBuffer.getChannelData(0));
      if (!frame) return;
      const payload = unpackHardwarePayload(frame);
      if (!payload) return;
      delivered = true;
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
