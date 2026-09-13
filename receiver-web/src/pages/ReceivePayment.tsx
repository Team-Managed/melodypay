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
    Activity,
    ShieldCheck,
    Waves,
} from "lucide-react";
import { CHAIN_CONFIGS, getChainConfig } from "../core/chains";
import { startHardwareChunkedListening, startHardwareListening, playHardwareChunkedPayload, playHardwarePayload } from "../core/hardware-audio";
import {
    broadcastTransaction,
    getFeeData,
    getNonce,
    getArcAuthorizationState,
    getArcUsdcBalance,
    validateSignedNativeTransfer,
    validateSignedReceiveAuthorization,
} from "../core/tx-builder";
import { ARC_CANONICAL_USDC, ARC_CHAIN_ID, generateAuthorizationNonce, splitAuthorizationSignature } from "../core/eip3009";
import { resolveMerchantName } from "../core/ensv2";
import { VibrantSoundBars } from "../components/VibrantSoundBars";

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
    isArc?: boolean;
    authNonce?: string;
    tokenValue?: bigint;
    validBefore?: bigint;
}

const PAYMENT_TTL_SECONDS = 60;

export function ReceivePayment() {
    const [recipientAddress, setRecipientAddress] = useState("");
    const [chainId, setChainId] = useState(10143);
    const [amount, setAmount] = useState("0.01");
    const [resolvedMerchantName, setResolvedMerchantName] = useState("");
    const [resolvedMerchantAddress, setResolvedMerchantAddress] = useState("");
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
        if (!recipientAddress.trim()) {
            setError("Enter a receiving address or ENS name.");
            return;
        }

        const isArc = chain.chainId === ARC_CHAIN_ID;
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

        try {
            let receiver: string;
            if (ethers.isAddress(recipientAddress.trim())) {
                receiver = ethers.getAddress(recipientAddress.trim());
                setResolvedMerchantName("");
                setResolvedMerchantAddress("");
            } else {
                setStatus("Resolving ENS merchant profile...");
                const profile = await resolveMerchantName(recipientAddress);
                receiver = profile.address;
                setResolvedMerchantName(profile.name);
                setResolvedMerchantAddress(profile.address);
            }
            setStep("waiting-sender");
            setStatus("Listening for the hardware wallet...");

            const { stop } = await startHardwareListening(async ({ text: data }) => {
                if (cancelledRef.current || !data.startsWith("ADDR|")) return;

                const senderText = data.slice("ADDR|".length).trim();
                if (!ethers.isAddress(senderText)) return;
                const sender = ethers.getAddress(senderText);

                stop();
                stopRef.current = null;
                setStep("fetching-network");
                setStatus(`Fetching ${chain.name} nonce and fee data...`);

                try {
                    const requestId = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
                    const gasLimit = 21000n;
                    let paymentRequest: string;
                    if (isArc) {
                        const balance = await getArcUsdcBalance(sender);
                        if (ethers.parseUnits(balance, 6) < value) throw new Error("Insufficient Arc USDC balance");
                        const authNonce = generateAuthorizationNonce();
                        const validBefore = BigInt(Math.floor(Date.now() / 1000) + PAYMENT_TTL_SECONDS);
                        pendingRef.current = {
                            sender,
                            nonce: 0,
                            requestId,
                            gasLimit: 100000n,
                            startedAt: Date.now(),
                            isArc: true,
                            authNonce,
                            tokenValue: value,
                            validBefore,
                        };
                        paymentRequest = ["PAY_ARC", ARC_CHAIN_ID, receiver, amount, validBefore, authNonce].join("|");
                    } else {
                        const [nonce, feeData] = await Promise.all([
                            getNonce(sender, chain.chainId),
                            getFeeData(chain.chainId),
                        ]);
                        pendingRef.current = { sender, nonce, requestId, gasLimit, startedAt: Date.now() };
                        paymentRequest = chain.chainId === 10143
                            ? `PAY|${receiver}|${amount}|${nonce}`
                            : ["PAY2", chain.chainId, receiver, amount, nonce, requestId, PAYMENT_TTL_SECONDS,
                                feeData.maxFeePerGas.toString(), feeData.maxPriorityFeePerGas.toString(), gasLimit].join("|");
                    }

                    setStep("broadcasting-request");
                    if (cancelledRef.current) return;
                    setStatus("Sending payment request...");
                    if (chain.chainId === 10143 && !isArc) await playHardwarePayload(paymentRequest);
                    else await playHardwareChunkedPayload(paymentRequest);

                    if (cancelledRef.current) return;
                    setStep("listening");
                    setStatus("Listening for the signed transaction...");
                    timeoutRef.current = window.setTimeout(() => {
                        if (!cancelledRef.current) {
                            resetSession("Audio timed out. Tap Start to create a fresh payment request.");
                        }
                    }, PAYMENT_TTL_SECONDS * 1000);

                    const { stop: stopChunked } = await startHardwareChunkedListening(
                        async (signedTx) => {
                            const pending = pendingRef.current;
                            if (!pending) return;
                            if (cancelledRef.current || (!pending.isArc && !signedTx.startsWith("0x")) || (pending.isArc && !signedTx.startsWith("AUTH|"))) return;

                            stopChunked();
                            stopRef.current = null;
                            clearTimeoutTimer();
                            setStep("verifying");
                            setStatus("Verifying the signed transaction...");

                            try {
                                if (pending.isArc) {
                                    const fields = signedTx.split("|");
                                    if (fields.length !== 5) throw new Error("Malformed Arc authorization");
                                    const validBefore = BigInt(fields[1]);
                                    const nonce = fields[2];
                                    const signatureBytes = `${fields[3]}${Number(fields[4]).toString(16).padStart(2, "0")}`;
                                    const signature = splitAuthorizationSignature(signatureBytes);
                                    const validated = validateSignedReceiveAuthorization({
                                        authorizer: pending.sender,
                                        recipient: receiver,
                                        value: pending.tokenValue!,
                                        validAfter: 0n,
                                        validBefore,
                                        nonce,
                                        ...signature,
                                    }, {
                                        expectedAuthorizer: pending.sender,
                                        expectedRecipient: receiver,
                                        expectedValue: pending.tokenValue!,
                                        maxValidBefore: pending.validBefore,
                                    });
                                    if (await getArcAuthorizationState(validated.authorizer, validated.nonce)) {
                                        throw new Error("Arc authorization nonce already used");
                                    }
                                    if (!(window as any).ethereum) throw new Error("Connect a gas-paying browser wallet to submit Arc USDC");
                                    setStep("submitting");
                                    setStatus(`Submitting ${amount} USDC authorization to Arc...`);
                                    const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
                                    const signer = await browserProvider.getSigner();
                                    const token = new ethers.Contract(ARC_CANONICAL_USDC, [
                                        "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
                                        "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
                                        "event Transfer(address indexed from, address indexed to, uint256 value)",
                                    ], signer);
                                    const tx = await token.receiveWithAuthorization(validated.authorizer, receiver, validated.value,
                                        0n, validBefore, validated.nonce, signature.v, signature.r, signature.s);
                                    const receipt = await tx.wait();
                                    const eventNames = new Set(receipt.logs.map((log: ethers.Log | ethers.EventLog) => {
                                        try { return token.interface.parseLog(log)?.name; } catch { return undefined; }
                                    }));
                                    if (!eventNames.has("AuthorizationUsed") || !eventNames.has("Transfer")) {
                                        throw new Error("Arc receipt missing AuthorizationUsed or Transfer evidence");
                                    }
                                    await playHardwareChunkedPayload(`RECEIPT|${receipt.hash}`);
                                    setTxHash(receipt.hash);
                                    setStep("done");
                                    setStatus(`${amount} USDC payment settled on Arc.`);
                                    return;
                                }

                                const parsed = await validateSignedNativeTransfer(signedTx, {
                                    sender: pending.sender, recipient: receiver, chainId: chain.chainId,
                                    value, nonce: pending.nonce, gasLimit: pending.gasLimit,
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
                                await playHardwareChunkedPayload(`RECEIPT|${hash}`);
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
            className="relative isolate flex min-h-screen w-full items-center overflow-hidden px-4 pb-10 pt-28 text-white sm:px-6 sm:pt-32 lg:px-10 lg:pb-12 lg:pt-28"
        >
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0d281a]">
                <img src="/image copy 2.png" alt="" className="h-full w-full scale-105 object-cover object-center opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#0d281a]/35 to-black/70" />
            </div>
            <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.75fr)]">
                <section className="rounded-3xl border border-white/20 bg-white/[0.09] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
            <div className="mb-8 flex items-center">
                <Link to="/" className="-ml-2 rounded-full p-2 text-white transition-colors hover:bg-white/15">
                    <ArrowLeft size={20} />
                </Link>
                <h2 className="flex-1 text-center text-xl font-serif font-medium mr-8 text-white">Receive Payment</h2>
            </div>

            {step === "setup" && (
                <div className="space-y-6 font-sans">
                    <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/15 p-4 text-center">
                        <span className="font-medium text-sm text-emerald-100">Online merchant terminal</span>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/70">Receiving address or ENS name</label>
                        <input
                            value={recipientAddress}
                            onChange={(event) => setRecipientAddress(event.target.value)}
                            placeholder="0x... or cafe.melodypay.eth"
                            className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/40 focus:border-sky-300/70 focus:ring-2 focus:ring-sky-300/20"
                        />
                    </div>

                    {resolvedMerchantName && (
                        <p className="text-xs text-emerald-200">Resolved {resolvedMerchantName} to {resolvedMerchantAddress}</p>
                    )}

                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/70">Network</label>
                        <select
                            value={chainId}
                            onChange={(event) => setChainId(Number(event.target.value))}
                            className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all focus:border-sky-300/70 focus:ring-2 focus:ring-sky-300/20"
                        >
                            {CHAIN_CONFIGS.map((profile) => (
                                <option key={profile.chainId} value={profile.chainId}>
                                    {profile.name} ({profile.nativeSymbol})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/70">Amount</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-xl font-bold text-white outline-none transition-all focus:border-sky-300/70 focus:ring-2 focus:ring-sky-300/20"
                        />
                    </div>

                    {error && <p className="rounded-xl border border-red-300/30 bg-red-400/15 p-3 text-sm text-red-100">{error}</p>}
                    <button
                        onClick={handleStart}
                        disabled={!recipientAddress || !amount}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-semibold text-[#111113] shadow-lg transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Mic size={18} /> Start listening
                    </button>
                </div>
            )}

            {step !== "setup" && step !== "done" && (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="mb-8 flex h-24 w-24 animate-pulse items-center justify-center rounded-full border border-white/30 bg-white/10 shadow-lg backdrop-blur-md">
                        {stepIcon()}
                    </div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-200">{stepLabel()}</p>
                    <p className="mb-8 text-center text-sm font-medium text-white">{status}</p>
                    <button onClick={() => resetSession()} className="text-xs font-medium text-white/70 transition-colors hover:text-white">Cancel</button>
                </div>
            )}

            {step === "done" && (
                <div className="flex flex-col items-center justify-center py-8">
                    <div className="mb-6 rounded-full bg-emerald-400/20 p-6 text-emerald-200">
                        <CheckCircle2 size={48} />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-white">Payment submitted</h3>
                    <p className="mb-10 text-sm font-medium text-white/70">{status}</p>
                    {txHash && (
                        <div className="mb-10 flex w-full flex-col items-center rounded-xl border border-white/20 bg-black/20 p-4">
                            <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">TX Hash</span>
                            <span className="w-full truncate text-center text-xs font-medium text-white">{txHash}</span>
                            {chain && (
                                <a href={`${chain.explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-sky-200 hover:underline">
                                    View on explorer -&gt;
                                </a>
                            )}
                        </div>
                    )}
                    <button onClick={() => resetSession()} className="w-full rounded-xl bg-white py-4 text-sm font-semibold text-[#111113] transition hover:bg-sky-50">Receive another</button>
                </div>
            )}
                </section>
                <aside className="relative hidden overflow-hidden rounded-3xl border border-white/20 bg-[#071c17] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] lg:block">
                    <VibrantSoundBars className="opacity-35" />
                    <div className="relative z-10 flex h-full flex-col justify-between">
                        <div>
                            <div className="mb-6 flex items-center gap-2 border-b border-white/15 pb-4 text-xs font-mono uppercase tracking-[0.18em] text-white/80">
                                <Waves size={15} className="text-sky-300" /> Acoustic telemetry
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-black/30 p-4 font-mono text-xs text-emerald-200">
                                <div className="mb-3 flex items-center gap-2 text-white/60"><Activity size={14} /> {step === "setup" ? "STANDBY" : step.toUpperCase()}</div>
                                <p className="break-words leading-6">{status || "Awaiting hardware wallet handshake"}</p>
                            </div>
                        </div>
                        <div className="space-y-3 text-sm text-white/75">
                            <div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" /> Physical approval stays on the hardware wallet.</div>
                            <div className="flex items-start gap-2"><Activity size={16} className="mt-0.5 shrink-0 text-sky-300" /> Audio frames are validated before broadcast.</div>
                        </div>
                    </div>
                </aside>
            </div>
        </motion.div>
    );
}
