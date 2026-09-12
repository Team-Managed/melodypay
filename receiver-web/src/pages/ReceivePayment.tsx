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
    validateSignedReceiveAuthorization,
    getArcUsdcBalance,
} from "../core/tx-builder";
import { generateAuthorizationNonce } from "../core/eip3009";

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
    authNonce?: string;
    requestId: number;
    gasLimit: bigint;
    startedAt: number;
    isArc?: boolean;
    tokenValue?: bigint;
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

        const isArc = chain.chainId === 5042002;
        let value: bigint;
        try {
            value = isArc ? ethers.parseUnits(amount, 6) : ethers.parseEther(amount);
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
                setStatus(`Fetching ${chain.name} context...`);

                try {
                    const requestId = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
                    let paymentRequest: string;

                    if (isArc) {
                        await getArcUsdcBalance(sender, 5042002);
                        const authNonce = generateAuthorizationNonce();
                        pendingRef.current = {
                            sender,
                            nonce: 0,
                            authNonce,
                            requestId,
                            gasLimit: 100000n,
                            startedAt: Date.now(),
                            isArc: true,
                            tokenValue: value,
                        };

                        paymentRequest = [
                            "PAY_ARC",
                            chain.chainId,
                            receiver,
                            amount,
                            authNonce,
                            requestId,
                            PAYMENT_TTL_SECONDS,
                        ].join("|");
                    } else {
                        const [nonce, feeData] = await Promise.all([
                            getNonce(sender, chain.chainId),
                            getFeeData(chain.chainId),
                        ]);
                        const gasLimit = 21000n;
                        pendingRef.current = {
                            sender,
                            nonce,
                            requestId,
                            gasLimit,
                            startedAt: Date.now(),
                            isArc: false,
                        };

                        paymentRequest = chain.chainId === 10143
                            ? `PAY|${receiver}|${amount}|${nonce}`
                            : [
                                "PAY2",
                                chain.chainId,
                                receiver,
                                amount,
                                nonce,
                                requestId,
                                PAYMENT_TTL_SECONDS,
                                feeData.maxFeePerGas.toString(),
                                feeData.maxPriorityFeePerGas.toString(),
                                gasLimit,
                            ].join("|");
                    }

                    setStep("broadcasting-request");
                    for (let attempt = 1; attempt <= 3; attempt += 1) {
                        if (cancelledRef.current) return;
                        setStatus(`Sending payment request (${attempt}/3)...`);
                        await playPayload(paymentRequest);
                        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000));
                    }

                    if (cancelledRef.current) return;
                    setStep("listening");
                    setStatus("Listening for authorization...");
                    timeoutRef.current = window.setTimeout(() => {
                        if (!cancelledRef.current) {
                            resetSession("Audio timed out. Tap Start to create a fresh payment request.");
                        }
                    }, PAYMENT_TTL_SECONDS * 1000);

                    const { stop: stopChunked } = await startChunkedListening(
                        async (signedData) => {
                            if (cancelledRef.current) return;
                            const pending = pendingRef.current;
                            if (!pending) return;

                            stopChunked();
                            stopRef.current = null;
                            clearTimeoutTimer();
                            setStep("verifying");
                            setStatus("Verifying authorization...");

                            try {
                                if (pending.isArc) {
                                    let authPayload: {
                                        authorizer: string;
                                        recipient: string;
                                        value: bigint;
                                        validAfter: bigint;
                                        validBefore: bigint;
                                        nonce: string;
                                        v: number;
                                        r: string;
                                        s: string;
                                    };

                                    if (signedData.startsWith("AUTH|")) {
                                        const parts = signedData.split("|");
                                        authPayload = {
                                            authorizer: parts[1],
                                            recipient: parts[2],
                                            value: BigInt(parts[3]),
                                            validAfter: BigInt(parts[4]),
                                            validBefore: BigInt(parts[5]),
                                            nonce: parts[6],
                                            v: Number(parts[7]),
                                            r: parts[8],
                                            s: parts[9],
                                        };
                                    } else {
                                        const sig = ethers.Signature.from(signedData);
                                        authPayload = {
                                            authorizer: pending.sender,
                                            recipient: receiver,
                                            value: pending.tokenValue!,
                                            validAfter: 0n,
                                            validBefore: BigInt(Math.floor(pending.startedAt / 1000) + PAYMENT_TTL_SECONDS),
                                            nonce: pending.authNonce!,
                                            v: sig.v,
                                            r: sig.r,
                                            s: sig.s,
                                        };
                                    }

                                    const validated = validateSignedReceiveAuthorization(authPayload, {
                                        expectedAuthorizer: pending.sender,
                                        expectedRecipient: receiver,
                                        expectedValue: pending.tokenValue!,
                                        chainId: chain.chainId,
                                    });

                                    if (seenTransactionsRef.current.has(validated.nonce)) {
                                        resetSession("Duplicate authorization ignored.");
                                        return;
                                    }
                                    seenTransactionsRef.current.add(validated.nonce);

                                    setStep("submitting");
                                    setStatus(`Submitting ${amount} USDC authorization to Arc...`);

                                    if (typeof window !== "undefined" && (window as any).ethereum) {
                                        try {
                                            const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
                                            const signer = await browserProvider.getSigner();
                                            const usdcContract = new ethers.Contract(
                                                "0x3600000000000000000000000000000000000000",
                                                [
                                                    "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
                                                ],
                                                signer,
                                            );
                                            const tx = await usdcContract.receiveWithAuthorization(
                                                authPayload.authorizer,
                                                authPayload.recipient,
                                                authPayload.value,
                                                authPayload.validAfter,
                                                authPayload.validBefore,
                                                authPayload.nonce,
                                                authPayload.v,
                                                authPayload.r,
                                                authPayload.s,
                                            );
                                            const receipt = await tx.wait();
                                            if (cancelledRef.current) return;
                                            setTxHash(receipt.hash);
                                            setStep("done");
                                            setStatus(`${amount} USDC payment settled on Arc.`);
                                        } catch (broadcastErr) {
                                            // Fallback to verified authorization display if broadcast rejected
                                            setStep("done");
                                            setStatus(`Authorization verified for ${amount} USDC from ${validated.authorizer} (Broadcast failed or declined: ${broadcastErr instanceof Error ? broadcastErr.message : "submission error"})`);
                                        }
                                    } else {
                                        setStep("done");
                                        setStatus(`Authorization verified for ${amount} USDC from ${validated.authorizer}. Nonce: ${validated.nonce.slice(0, 10)}... (Connect browser wallet to broadcast onchain)`);
                                    }
                                } else {
                                    const parsed = await validateSignedNativeTransfer(signedData, {
                                        sender: pending.sender,
                                        recipient: receiver,
                                        chainId: chain.chainId,
                                        value,
                                        nonce: pending.nonce,
                                        gasLimit: pending.gasLimit,
                                    });
                                    const transactionHash = parsed.hash ?? ethers.keccak256(ethers.getBytes(signedData));
                                    if (seenTransactionsRef.current.has(transactionHash)) {
                                        resetSession("Duplicate transaction ignored. Start a new payment if needed.");
                                        return;
                                    }
                                    seenTransactionsRef.current.add(transactionHash);

                                    setStep("submitting");
                                    setStatus(`Broadcasting ${ethers.formatEther(parsed.value)} ${chain.nativeSymbol}...`);
                                    const hash = await broadcastTransaction(signedData, chain.chainId);
                                    if (cancelledRef.current) return;
                                    setTxHash(hash);
                                    setStep("done");
                                    setStatus(`${ethers.formatEther(parsed.value)} ${chain.nativeSymbol} submitted.`);
                                }
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
