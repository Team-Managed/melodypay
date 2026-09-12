import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { ArrowLeft, Radio, Send, Volume2 } from "lucide-react";
import { CHAIN_CONFIGS, getChainConfig } from "../core/chains";
import { startListening } from "../core/listener";
import { playChunkedPayload, playPayload } from "../core/broadcaster";
import { getAddress, signTransaction } from "../core/tx-builder";

type Step = "setup" | "announcing" | "listening" | "signing" | "broadcasting" | "done";

function normalizePrivateKey(value: string): string {
  return value.trim().startsWith("0x") ? value.trim() : `0x${value.trim()}`;
}

export function SendPayment() {
  const [privateKey, setPrivateKey] = useState("");
  const [chainId, setChainId] = useState(10143);
  const [step, setStep] = useState<Step>("setup");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);

  const chain = getChainConfig(chainId);
  let sender = "";
  try {
    if (privateKey.trim()) sender = getAddress(normalizePrivateKey(privateKey));
  } catch {
    sender = "";
  }

  useEffect(() => () => {
    cancelledRef.current = true;
    stopRef.current?.();
  }, []);

  function reset() {
    cancelledRef.current = true;
    stopRef.current?.();
    stopRef.current = null;
    setStep("setup");
    setStatus("");
    setError("");
  }

  async function start() {
    if (!chain || !sender) {
      setError("Enter a valid private key and supported chain.");
      return;
    }
    cancelledRef.current = false;
    setError("");
    setStep("announcing");
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (cancelledRef.current) return;
        setStatus(`Broadcasting wallet address (${attempt}/3)...`);
        await playPayload(`ADDR|${sender}`);
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setStep("listening");
      setStatus("Listening for the receiver payment request...");
      const listener = await startListening(async (data) => {
        if (cancelledRef.current || (!data.startsWith("PAY|") && !data.startsWith("PAY2|"))) return;
        listener.stop();
        stopRef.current = null;

        const parts = data.split("|");
        const request = data.startsWith("PAY2|")
          ? { to: parts[2], amount: parts[3], nonce: Number(parts[4]), maxFee: parts[7], priority: parts[8], gasLimit: Number(parts[9]) }
          : { to: parts[1], amount: parts[2], nonce: Number(parts[3]), maxFee: "150", priority: "2", gasLimit: 21000 };
        if (!ethers.isAddress(request.to) || !Number.isSafeInteger(request.nonce) || !Number.isSafeInteger(request.gasLimit)) {
          setError("Invalid payment request received.");
          setStep("setup");
          return;
        }

        try {
          setStep("signing");
          setStatus("Signing locally. No private key leaves this device.");
          const signed = await signTransaction({
            to: request.to,
            value: request.amount,
            chainId,
            nonce: request.nonce,
            gasLimit: request.gasLimit,
            maxFeePerGas: request.maxFee,
            maxPriorityFeePerGas: request.priority,
          }, normalizePrivateKey(privateKey));
          if (cancelledRef.current) return;

          setStep("broadcasting");
          setStatus("Sending signed transaction back to the receiver...");
          await playChunkedPayload(signed);
          setStep("done");
          setStatus("Signed transaction sent over audio.");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Signing failed.");
          setStep("setup");
        }
      });
      stopRef.current = listener.stop;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audio flow failed.");
      setStep("setup");
    }
  }

  return (
    <main className="w-full max-w-md mx-auto px-5 sm:px-8">
      <div className="flex items-center mb-8">
        <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-white transition-colors text-app-dark" aria-label="Back to home">
          <ArrowLeft size={20} />
        </Link>
        <div className="ml-3">
          <p className="text-xs uppercase tracking-[0.24em] text-app-dark/45 font-semibold">Mobile sender</p>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-app-dark">Send payment</h1>
        </div>
      </div>

      {step === "setup" && (
        <section className="rounded-3xl border border-app-border bg-white p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)] space-y-5">
          <p className="text-sm leading-6 text-app-dark/60">Air-gapped demo flow: this phone announces its address, receives an invoice, signs locally, and sends the signed transaction back.</p>
          <input type="password" value={privateKey} onChange={(event) => setPrivateKey(event.target.value)} placeholder="Private key (demo only)" className="w-full rounded-2xl border border-app-border bg-[#FAFAFA] px-4 py-3 text-sm outline-none" />
          <select value={chainId} onChange={(event) => setChainId(Number(event.target.value))} className="w-full rounded-2xl border border-app-border bg-[#FAFAFA] px-4 py-3 text-sm outline-none">
            {CHAIN_CONFIGS.map((profile) => <option key={profile.chainId} value={profile.chainId}>{profile.name} ({profile.nativeSymbol})</option>)}
          </select>
          {sender && <p className="break-all text-xs text-app-dark/50">Sender: {sender}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={start} disabled={!sender} className="w-full rounded-2xl bg-app-dark px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"><Send size={17} /> Start sender flow</button>
        </section>
      )}

      {step !== "setup" && step !== "done" && (
        <section className="rounded-3xl border border-app-border bg-white p-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-app-dark text-white animate-pulse"><Radio size={30} /></div>
          <p className="text-sm font-medium text-app-dark">{status}</p>
          <button onClick={reset} className="mt-8 rounded-2xl border border-app-border px-5 py-3 text-sm font-semibold text-app-dark">Cancel</button>
        </section>
      )}

      {step === "done" && (
        <section className="rounded-3xl border border-app-border bg-white p-8 text-center">
          <Volume2 size={42} className="mx-auto mb-5 text-green-500" />
          <p className="text-sm font-semibold text-app-dark">{status}</p>
          <button onClick={reset} className="mt-8 w-full rounded-2xl bg-app-dark px-4 py-3 text-sm font-semibold text-white">Send another</button>
        </section>
      )}
    </main>
  );
}
