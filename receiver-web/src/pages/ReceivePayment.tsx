import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    AlertCircle,
    Check,
    CheckCircle2,
    Copy,
    ExternalLink,
    Globe,
    Mic,
    Printer,
    Radio,
    RefreshCw,
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
import type { ReceiptData } from "./PaymentReceipt";

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
    const navigate = useNavigate();
    const [recipientAddress, setRecipientAddress] = useState("");
    const [chainId, setChainId] = useState(10143);
    const [amount, setAmount] = useState("0.01");
    const [resolvedMerchantName, setResolvedMerchantName] = useState("");
    const [resolvedMerchantAddress, setResolvedMerchantAddress] = useState("");
    const [step, setStep] = useState<Step>("setup");
    const [status, setStatus] = useState("");
    const [txHash, setTxHash] = useState("");
    const [error, setError] = useState("");
    const [copiedHash, setCopiedHash] = useState(false);
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

    function redirectToReceipt(receiptData: ReceiptData) {
        try {
            localStorage.setItem("melodypay_last_receipt", JSON.stringify(receiptData));
        } catch {
            // Receipt navigation still works when local storage is unavailable.
        }
        window.setTimeout(() => {
            if (!cancelledRef.current) navigate("/receipt", { state: receiptData });
        }, 900);
    }

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
                                     redirectToReceipt({
                                         type: "pos_payment",
                                         amount,
                                         token: "USDC",
                                         recipient: receiver,
                                         txHash: receipt.hash,
                                         payer: validated.authorizer,
                                         chainId: chain.chainId,
                                         networkName: chain.name,
                                         timestamp: new Date().toISOString(),
                                         nonce: validated.nonce,
                                     });
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
                                 redirectToReceipt({
                                     type: "pos_payment",
                                     amount: ethers.formatEther(parsed.value),
                                     token: chain.nativeSymbol,
                                     recipient: receiver,
                                     txHash: hash,
                                     payer: parsed.from ?? pending.sender,
                                     chainId: chain.chainId,
                                     networkName: chain.name,
                                     timestamp: new Date().toISOString(),
                                     nonce: pending.nonce.toString(),
                                 });
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

    async function copyHash() {
        if (!txHash) return;
        await navigator.clipboard.writeText(txHash);
        setCopiedHash(true);
        window.setTimeout(() => setCopiedHash(false), 2000);
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative isolate flex min-h-screen w-full flex-col overflow-hidden px-4 pb-10 pt-28 text-white sm:px-6 sm:pt-32 lg:px-10 lg:pb-12 lg:pt-28"
        >
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0d281a]">
                <img src="/image copy 2.png" alt="" className="h-full w-full scale-105 object-cover object-center opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#0d281a]/35 to-black/70" />
                <div className="absolute inset-0 bg-[#0d281a]/15 backdrop-blur-[0.5px]" />
            </div>
            <div className="relative z-10 mx-auto flex w-full max-w-[1380px] flex-1 flex-col justify-center">
                <div className="mx-auto mb-6 max-w-3xl text-center lg:mb-7">
                    <span className="mb-2 block text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-sky-200 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">// AIR-GAPPED ACOUSTIC POS TERMINAL</span>
                    <h1 className="text-3xl font-bold leading-[1.12] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-4xl lg:text-5xl">Receive Sound Payments.<br /><span className="font-normal text-white/85">Air-gapped acoustic wire. Settled on Base.</span></h1>
                    <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] sm:text-base">Broadcast ultrasound POS invoices and capture offline cryptographically signed payment authorizations through air-gapped acoustic audio.</p>
                </div>
                <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2 lg:gap-7 lg:max-h-[560px]">
                <section className="flex h-full flex-col justify-between rounded-2xl border border-white/25 bg-white/[0.07] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/10 backdrop-blur-2xl sm:p-6">
            <div className="mb-8 flex items-center">
                <Link to="/" className="-ml-2 rounded-full p-2 text-white transition-colors hover:bg-white/15">
                    <ArrowLeft size={20} />
                </Link>
                <h2 className="flex-1 text-center text-xl font-serif font-medium mr-8 text-white">Receive Payment</h2>
            </div>

            <div className="mb-5 flex items-center justify-between rounded-xl border border-white/20 bg-white/[0.08] p-2.5 px-3.5 text-xs backdrop-blur-md">
                <div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15"><Radio size={12} /></div><span className="font-semibold text-white">Keyless online terminal</span></div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">Multichain EVM</span>
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
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-white/50"><span>ENSv2 resolution enabled</span><span className="h-1 w-1 rounded-full bg-emerald-300" /><span>Hardware handshake</span></div>
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
                        <div className="mt-2 flex flex-wrap gap-2 border-t border-white/10 pt-2">
                            {["0.01", "0.10", "1.00"].map((preset) => <button key={preset} type="button" onClick={() => setAmount(preset)} className={`rounded-lg px-2.5 py-1 text-[10px] font-mono transition ${amount === preset ? "bg-white font-bold text-black" : "border border-white/15 bg-white/10 text-white/75 hover:bg-white/20"}`}>{preset} {chain?.nativeSymbol}</button>)}
                        </div>
                    </div>

                    {error && <p className="flex items-start gap-2 rounded-xl border border-red-300/30 bg-red-400/15 p-3 text-sm text-red-100"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</p>}
                    <button
                        onClick={handleStart}
                        disabled={!recipientAddress || !amount}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-semibold text-[#111113] shadow-lg transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Mic size={18} /> Initialize acoustic turn-taking <ArrowRight size={16} />
                    </button>
                    <p className="mt-2 text-center text-xs text-white/55">Emits the ultrasound invoice chime to initiate the hardware handshake.</p>
                </div>
            )}

            {step !== "setup" && step !== "done" && (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="relative mb-8 flex h-20 w-20 animate-pulse items-center justify-center rounded-full border border-white/30 bg-white/10 shadow-lg backdrop-blur-md">
                        {stepIcon()}
                        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black shadow">{stepLabel().replace("Phase ", "") || "0"}</span>
                    </div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200">{stepLabel()} // ACOUSTIC ENGINE</p>
                    <p className="mb-2 text-center text-base font-semibold text-white">{status}</p>
                    <p className="mb-8 max-w-sm text-center text-xs leading-5 text-white/60">Keep the ESP32-S3 sound wallet near the terminal speaker. The device will chirp signed authorization chunks back.</p>
                    <button onClick={() => resetSession("Session cancelled by merchant.")} className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"><RefreshCw size={13} /> Cancel acoustic request</button>
                </div>
            )}

            {step === "done" && (
                <div className="flex flex-col items-center justify-center py-8">
                    <div className="mb-4 rounded-xl border border-emerald-400/35 bg-emerald-500/20 p-4 text-center">
                        <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 mx-auto"><CheckCircle2 size={20} /></div>
                        <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-200">Payment settled on {chain?.name || "network"}</span>
                        <div className="mt-1 text-xl font-bold text-white">{amount} {chain?.nativeSymbol || "USDC"}</div>
                    </div>
                    <p className="mb-4 text-center text-xs text-white/75">{status}</p>
                    {txHash && (
                        <div className="mb-6 w-full rounded-xl border border-white/20 bg-white/[0.08] p-3 font-mono text-xs">
                            <div className="flex items-center justify-between text-white/70"><span>RECIPIENT</span><span className="font-bold text-white">{recipientAddress.slice(0, 8)}...{recipientAddress.slice(-6)}</span></div>
                            <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2"><span className="truncate text-white/70">{txHash.slice(0, 16)}...{txHash.slice(-8)}</span><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={copyHash} className="rounded p-1 text-white transition hover:bg-white/20">{copiedHash ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}</button>{chain && <a href={`${chain.explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-white transition hover:bg-white/20"><ExternalLink size={12} /></a>}</div></div>
                         </div>
                    )}
                    <div className="w-full space-y-2">
                        <button type="button" onClick={() => navigate("/receipt")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-semibold text-[#111113] transition hover:bg-sky-50"><Printer size={14} /> View thermal POS receipt</button>
                        <button onClick={() => resetSession()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"><RefreshCw size={13} /> Receive next payment</button>
                    </div>
                </div>
            )}
                </section>
                <aside className="relative hidden overflow-hidden rounded-2xl border border-white/25 bg-white/[0.07] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/10 backdrop-blur-2xl sm:p-6 lg:flex lg:flex-col lg:justify-between">
                    <VibrantSoundBars className="opacity-35" />
                    <div className="relative z-10 flex h-full flex-col justify-between">
                        <div>
                            <div className="mb-4 flex items-center justify-between border-b border-white/20 pb-3 text-xs font-mono uppercase tracking-[0.18em] text-white/80">
                                <Waves size={15} className="text-sky-300" /> Acoustic telemetry
                                <span className="flex items-center gap-1.5 text-[10px] tracking-wider"><span className={`h-2 w-2 rounded-full ${step === "waiting-sender" || step === "listening" ? "animate-pulse bg-emerald-400" : step === "broadcasting-request" ? "animate-pulse bg-amber-400" : "bg-white/50"}`} />{step === "waiting-sender" || step === "listening" ? "LISTENING" : step === "broadcasting-request" ? "BROADCASTING" : "STANDBY"}</span>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-black/30 p-4 font-mono text-xs text-emerald-200">
                                <div className="mb-3 flex items-center gap-2 text-white/60"><Activity size={14} /> {step === "setup" ? "STANDBY" : step.toUpperCase()}</div>
                                <p className="break-words leading-6">{status || "Awaiting hardware wallet handshake"}</p>
                            </div>
                        </div>
                        <div className="space-y-3 border-t border-dashed border-white/20 pt-4 text-xs leading-5 text-white/75">
                            <div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" /> <span><strong className="text-white">Acoustic Wire</strong>: audio packets demodulated locally on-chip.</span></div>
                            <div className="flex items-start gap-2"><Activity size={16} className="mt-0.5 shrink-0 text-sky-300" /> <span><strong className="text-white">Zero Radios</strong>: no Wi-Fi or Bluetooth required for authorization.</span></div>
                            <div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" /> <span><strong className="text-white">Tactile Switch</strong>: physical approval remains on the hardware wallet.</span></div>
                        </div>
                    </div>
                </aside>
            </div>
            </div>
        </motion.div>
    );
}
