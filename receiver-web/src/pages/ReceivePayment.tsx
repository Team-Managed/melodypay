import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    CheckCircle2,
    Globe,
    Mic,
    Radio,
    Search,
} from "lucide-react";
import { CHAIN_CONFIGS, getChainConfig } from "../core/chains";
import { startChunkedListening, startListening } from "../core/listener";
import { playPayload } from "../core/broadcaster";
import {
    broadcastTransaction,
    getFeeData,
    getNonce,
    validateSignedNativeTransfer,
} from "../core/tx-builder";

type Step =
    | "setup"
    | "waiting-sender"
    | "fetching-network"
    | "broadcasting-request"
    | "listening"
    | "verifying"
    | "submitting"
    | "done";

interface PendingPayment {
    sender: string;
    nonce: number;
    requestId: number;
    gasLimit: bigint;
    startedAt: number;
}

const PAYMENT_TTL_SECONDS = 60;

export function ReceivePayment() {
    const [recipientAddress, setRecipientAddress] = useState("");
    const [chainId, setChainId] = useState(10143);
    const [amount, setAmount] = useState("0.01");
    const [step, setStep] = useState<Step>("setup");
    const [status, setStatus] = useState("");
    const [txHash, setTxHash] = useState("");
    const [error, setError] = useState("");
    const stopRef = useRef<(() => void) | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const cancelledRef = useRef(false);
    const pendingRef = useRef<PendingPayment | null>(null);
    const seenTransactionsRef = useRef(new Set<string>());

    useEffect(() => {
        return () => {
            cancelledRef.current = true;
            stopRef.current?.();
            if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        };
    }, []);

    const chain = getChainConfig(chainId);

    function clearTimeoutTimer() {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }

    function resetSession(message = "") {
        stopRef.current?.();
        stopRef.current = null;
        clearTimeoutTimer();
        pendingRef.current = null;
        setStep("setup");
        setStatus("");
        setTxHash("");
        setError(message);
    }

    async function handleStart() {
        setError("");
        setTxHash("");
        if (!chain) {
            setError("Unsupported chain selected.");
            return;
        }
        if (!ethers.isAddress(recipientAddress)) {
            setError("Enter a valid receiving address.");
            return;
        }

        let value: bigint;
        try {
            value = ethers.parseEther(amount);
        } catch {
            setError("Enter a valid amount.");
            return;
        }
        if (value <= 0n) {
            setError("Amount must be greater than zero.");
            return;
        }

        cancelledRef.current = false;
        const receiver = ethers.getAddress(recipientAddress);

        try {
            setStep("waiting-sender");
            setStatus("Listening for the hardware wallet...");

            const { stop } = await startListening(async (data) => {
                if (cancelledRef.current || !data.startsWith("ADDR|")) return;

                const senderText = data.slice("ADDR|".length).trim();
                if (!ethers.isAddress(senderText)) return;
                const sender = ethers.getAddress(senderText);

                stop();
                stopRef.current = null;
                setStep("fetching-network");
                setStatus(`Fetching ${chain.name} nonce and fee data...`);

                try {
                    const [nonce, feeData] = await Promise.all([
                        getNonce(sender, chain.chainId),
                        getFeeData(chain.chainId),
                    ]);
                    const requestId = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
                    const gasLimit = 21000n;
                    pendingRef.current = {
                        sender,
                        nonce,
                        requestId,
                        gasLimit,
                        startedAt: Date.now(),
                    };

                    // Keep PAY compatibility for the current browser proof of concept.
                    // PAY2 carries the chain and fee fields needed by the hardware wallet.
                    const paymentRequest = chain.chainId === 10143
                        ? `PAY|${receiver}|${amount}|${nonce}`
                        : [
                            "PAY2",
                            chain.chainId,
                            receiver,
                            amount,
                            nonce,
                            requestId,
                            PAYMENT_TTL_SECONDS,
                            ethers.formatUnits(feeData.maxFeePerGas, "gwei"),
                            ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei"),
                            gasLimit,
                        ].join("|");

                    setStep("broadcasting-request");
                    for (let attempt = 1; attempt <= 3; attempt += 1) {
                        if (cancelledRef.current) return;
                        setStatus(`Sending payment request (${attempt}/3)...`);
                        await playPayload(paymentRequest);
                        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000));
                    }

                    if (cancelledRef.current) return;
                    setStep("listening");
                    setStatus("Listening for the signed transaction...");
                    timeoutRef.current = window.setTimeout(() => {
                        if (!cancelledRef.current) {
                            resetSession("Audio timed out. Tap Start to create a fresh payment request.");
                        }
                    }, PAYMENT_TTL_SECONDS * 1000);

                    const { stop: stopChunked } = await startChunkedListening(
                        async (signedTx) => {
                            if (cancelledRef.current || !signedTx.startsWith("0x")) return;
                            const pending = pendingRef.current;
                            if (!pending) return;

                            stopChunked();
                            stopRef.current = null;
                            clearTimeoutTimer();
                            setStep("verifying");
                            setStatus("Verifying the signed transaction...");

                            try {
                                const parsed = await validateSignedNativeTransfer(signedTx, {
                                    sender: pending.sender,
                                    recipient: receiver,
                                    chainId: chain.chainId,
                                    value,
                                    nonce: pending.nonce,
                                    gasLimit: pending.gasLimit,
                                });
                                const transactionHash = parsed.hash ?? ethers.keccak256(ethers.getBytes(signedTx));
                                if (seenTransactionsRef.current.has(transactionHash)) {
                                    resetSession("Duplicate transaction ignored. Start a new payment if needed.");
                                    return;
                                }
                                seenTransactionsRef.current.add(transactionHash);

                                setStep("submitting");
                                setStatus(`Broadcasting ${ethers.formatEther(parsed.value)} ${chain.nativeSymbol}...`);
                                const hash = await broadcastTransaction(signedTx, chain.chainId);
                                if (cancelledRef.current) return;
                                setTxHash(hash);
                                setStep("done");
                                setStatus(`${ethers.formatEther(parsed.value)} ${chain.nativeSymbol} submitted.`);
                            } catch (err) {
                                if (!cancelledRef.current) {
                                    resetSession(err instanceof Error ? err.message : "Transaction validation failed.");
                                }
                            }
                        },
                        (message) => {
                            if (!cancelledRef.current) setStatus(message);
                        },
                    );
                    stopRef.current = stopChunked;
                } catch (err) {
                    if (!cancelledRef.current) {
                        resetSession(err instanceof Error ? err.message : "Could not create payment request.");
                    }
                }
            });
            stopRef.current = stop;
        } catch (err) {
            resetSession(err instanceof Error ? err.message : "Could not access the microphone.");
        }
    }

    const stepIcon = () => {
        if (step === "waiting-sender") return <Mic size={32} className="text-white" />;
        if (step === "fetching-network") return <Globe size={32} className="text-white" />;
        if (step === "broadcasting-request") return <Radio size={32} className="text-white" />;
        if (step === "listening") return <Search size={32} className="text-white" />;
        return <Globe size={32} className="text-white" />;
    };

    const stepLabel = () => {
        if (step === "waiting-sender") return "Phase 1";
        if (step === "fetching-network") return "Phase 2";
        if (step === "broadcasting-request") return "Phase 3";
        if (step === "listening") return "Phase 4";
        if (step === "verifying") return "Phase 5";
        if (step === "submitting") return "Phase 6";
        return "";
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md mx-auto p-10 bg-white border border-app-border rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)]"
        >
            <div className="flex items-center mb-10">
                <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-app-dark">
                    <ArrowLeft size={20} />
                </Link>
                <h2 className="flex-1 text-center text-xl font-serif font-medium mr-8 text-app-dark">Receive Payment</h2>
            </div>

            {step === "setup" && (
                <div className="space-y-6 font-sans">
                    <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                        <span className="font-medium text-sm text-green-800">Online merchant terminal</span>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-app-dark/60 mb-2 block uppercase tracking-wider">Receiving address</label>
                        <input
                            value={recipientAddress}
                            onChange={(event) => setRecipientAddress(event.target.value)}
                            placeholder="0x..."
                            className="w-full bg-[#FAFAFA] border border-app-border focus:border-app-dark outline-none px-4 py-3 rounded-xl text-sm text-app-dark transition-all"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-app-dark/60 mb-2 block uppercase tracking-wider">Network</label>
                        <select
                            value={chainId}
                            onChange={(event) => setChainId(Number(event.target.value))}
                            className="w-full bg-[#FAFAFA] border border-app-border focus:border-app-dark outline-none px-4 py-3 rounded-xl text-sm text-app-dark transition-all"
                        >
                            {CHAIN_CONFIGS.map((profile) => (
                                <option key={profile.chainId} value={profile.chainId}>
                                    {profile.name} ({profile.nativeSymbol})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-app-dark/60 mb-2 block uppercase tracking-wider">Amount</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            className="w-full bg-[#FAFAFA] border border-app-border focus:border-app-dark outline-none px-4 py-3 rounded-xl text-xl font-bold text-app-dark transition-all"
                        />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button
                        onClick={handleStart}
                        disabled={!recipientAddress || !amount}
                        className="w-full mt-6 bg-[#1C1C1E] text-white py-4 rounded-xl text-sm font-medium hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Mic size={18} /> Start listening
                    </button>
                </div>
            )}

            {step !== "setup" && step !== "done" && (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-24 h-24 rounded-full vibrant-gradient-3 flex items-center justify-center shadow-lg mb-8 animate-pulse">
                        {stepIcon()}
                    </div>
                    <p className="text-xs font-semibold text-app-dark/50 uppercase tracking-wider mb-2">{stepLabel()}</p>
                    <p className="text-sm font-medium text-app-dark text-center mb-8">{status}</p>
                    <button onClick={() => resetSession()} className="text-xs font-medium text-app-dark/60 hover:text-app-dark transition-colors">Cancel</button>
                </div>
            )}

            {step === "done" && (
                <div className="flex flex-col items-center justify-center py-8">
                    <div className="bg-green-50 rounded-full p-6 mb-6">
                        <CheckCircle2 size={48} className="text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-app-dark mb-2">Payment submitted</h3>
                    <p className="text-sm font-medium text-app-dark/60 mb-10">{status}</p>
                    {txHash && (
                        <div className="w-full bg-[#FAFAFA] border border-app-border p-4 rounded-xl mb-10 flex flex-col items-center">
                            <span className="text-[10px] font-semibold text-app-dark/50 uppercase tracking-wider mb-1">TX Hash</span>
                            <span className="text-xs font-medium text-app-dark truncate w-full text-center">{txHash}</span>
                            {chain && (
                                <a href={`${chain.explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 mt-2 hover:underline">
                                    View on explorer -&gt;
                                </a>
                            )}
                        </div>
                    )}
                    <button onClick={() => resetSession()} className="w-full bg-[#1C1C1E] text-white py-4 rounded-xl text-sm font-medium hover:bg-black transition-colors">Receive another</button>
                </div>
            )}
        </motion.div>
    );
}
