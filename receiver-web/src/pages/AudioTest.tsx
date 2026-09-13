import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Mic,
  Radio,
  Square,
  Volume2,
} from "lucide-react";
import { playHardwarePayload, startHardwareListening } from "../core/hardware-audio";
import { MAX_HARDWARE_PAYLOAD_BYTES } from "../core/hardware-ggwave-frame";

type BenchState = "idle" | "emitting" | "listening" | "received" | "error";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied. Allow microphone access and try again.";
  }
  if (error instanceof Error) return error.message;
  return "The audio test could not be started.";
}

export function AudioTest() {
  const [payload, setPayload] = useState("hello from my phone");
  const [state, setState] = useState<BenchState>("idle");
  const [status, setStatus] = useState("Ready for a hardware audio test.");
  const [error, setError] = useState("");
  const [decodedText, setDecodedText] = useState("");
  const [decodedBytes, setDecodedBytes] = useState<Uint8Array | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const payloadByteLength = new TextEncoder().encode(payload).length;
  const payloadTooLarge = payloadByteLength > MAX_HARDWARE_PAYLOAD_BYTES;

  useEffect(() => {
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

  function clearResult() {
    setDecodedText("");
    setDecodedBytes(null);
  }

  async function handleEmit() {
    if (!payload.trim() || payloadTooLarge || state === "emitting") return;
    stopRef.current?.();
    stopRef.current = null;
    setError("");
    clearResult();
    setState("emitting");
    setStatus("Emitting from this phone. Keep the speaker near the hardware microphone.");
    try {
      await playHardwarePayload(payload);
      setState("idle");
      setStatus("Emission complete. Check the hardware console for the received payload.");
    } catch (caught) {
      setState("error");
      const message = errorMessage(caught);
      setError(message);
      setStatus("Emission failed.");
    }
  }

  async function handleListen() {
    if (state === "listening") return;
    stopRef.current?.();
    stopRef.current = null;
    setError("");
    clearResult();
    setState("listening");
    setStatus("Listening. Run `tx hello` on the hardware, then wait for the result.");
    try {
      const listener = await startHardwareListening((decoded) => {
        setDecodedText(decoded.text);
        setDecodedBytes(decoded.payloadBytes);
        setState("received");
        setStatus("Payload received from the hardware.");
        stopRef.current?.();
        stopRef.current = null;
      });
      stopRef.current = listener.stop;
    } catch (caught) {
      setState("error");
      const message = errorMessage(caught);
      setError(message);
      setStatus("Listening failed.");
    }
  }

  function handleStop() {
    stopRef.current?.();
    stopRef.current = null;
    setState("idle");
    setStatus("Listening stopped.");
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen w-full max-w-2xl mx-auto px-5 pb-10 pt-28 sm:px-8 sm:pt-32"
    >
      <div className="flex items-center mb-8">
        <Link
          to="/"
          className="p-2 -ml-2 rounded-full hover:bg-white transition-colors text-app-dark"
          aria-label="Back to home"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="ml-3">
          <p className="text-xs uppercase tracking-[0.24em] text-app-dark/45 font-semibold">Audio bench</p>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-app-dark">Test the sound link</h1>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-app-border bg-white/70 px-4 py-3 text-sm text-app-dark/65">
        Uses the same 48 kHz audible ggwave frame as the ESP32. Keep the phone speaker and microphone close to the hardware.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-3xl border border-app-border bg-white p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="rounded-2xl bg-[#fff2cc] p-3 text-app-dark"><Volume2 size={20} /></div>
            <div>
              <h2 className="font-semibold text-app-dark">Emit to hardware</h2>
              <p className="text-xs text-app-dark/50">Phone speaker to ESP32 microphone</p>
            </div>
          </div>
          <label htmlFor="audio-payload" className="text-xs font-semibold uppercase tracking-wider text-app-dark/50">
            Test message
          </label>
          <textarea
            id="audio-payload"
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            rows={3}
            maxLength={63}
            className="mt-2 w-full resize-none rounded-2xl border border-app-border bg-[#FAFAFA] px-4 py-3 text-sm text-app-dark outline-none focus:border-app-dark"
            placeholder="hello from my phone"
          />
          <p className={`mt-2 text-xs ${payloadTooLarge ? "text-red-600" : "text-app-dark/45"}`}>
            {payloadByteLength}/{MAX_HARDWARE_PAYLOAD_BYTES} UTF-8 bytes
          </p>
          <button
            type="button"
            onClick={handleEmit}
            disabled={!payload.trim() || payloadTooLarge || state === "emitting"}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-app-dark px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Radio size={17} />
            {state === "emitting" ? "Emitting..." : "Emit to hardware"}
          </button>
        </section>

        <section className="rounded-3xl border border-app-border bg-white p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="rounded-2xl bg-[#dff7ed] p-3 text-app-dark"><Mic size={20} /></div>
            <div>
              <h2 className="font-semibold text-app-dark">Listen from hardware</h2>
              <p className="text-xs text-app-dark/50">ESP32 speaker to phone microphone</p>
            </div>
          </div>
          <p className="min-h-[60px] text-sm leading-6 text-app-dark/60">
            Tap listen first, then enter <code className="rounded bg-[#FAFAFA] px-1.5 py-0.5 text-xs text-app-dark">tx hello</code> in the ESP32 console.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleListen}
              disabled={state === "listening"}
              className="flex items-center justify-center gap-2 rounded-2xl bg-app-dark px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Mic size={17} />
              {state === "listening" ? "Listening..." : "Start listening"}
            </button>
            <button
              type="button"
              onClick={handleStop}
              disabled={state !== "listening"}
              className="flex items-center justify-center gap-2 rounded-2xl border border-app-border px-4 py-3 text-sm font-semibold text-app-dark transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Square size={15} /> Stop
            </button>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-3xl border border-app-border bg-white p-5">
        <div className="flex items-start gap-3">
          {state === "received" ? <CheckCircle2 className="mt-0.5 text-green-500" size={20} /> : <div className="mt-2 h-2 w-2 rounded-full bg-app-dark/30" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/45">Status</p>
            <p className="mt-1 text-sm text-app-dark">{status}</p>
            {error && (
              <p className="mt-3 flex items-start gap-2 text-sm text-red-600">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}
          </div>
        </div>
      </section>

      {decodedBytes && (
        <section className="mt-4 rounded-3xl border border-app-border bg-[#1C1C1E] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Decoded payload</p>
          <p className="mt-3 break-words text-xl font-medium">{decodedText}</p>
          <p className="mt-4 break-all font-mono text-xs leading-5 text-white/55">{toHex(decodedBytes)}</p>
        </section>
      )}
    </motion.main>
  );
}
