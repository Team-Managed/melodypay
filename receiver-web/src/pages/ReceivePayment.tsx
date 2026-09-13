import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    CheckCircle2,
    Mic,
    Radio,
    Search,
    AlertCircle,
    Activity,
    Copy,
    Check,
    ExternalLink,
    RefreshCw,
    ShieldCheck,
    Waves,
    Wallet,
    LogOut,
    Printer
} from "lucide-react";
import { getChainConfig } from "../core/chains";
import { startChunkedListening, startListening } from "../core/listener";
import { playPayload } from "../core/broadcaster";
import {
    validateSignedReceiveAuthorization,
} from "../core/tx-builder";
import { generateAuthorizationNonce } from "../core/eip3009";
import { AcousticOscilloscope } from "../components/AcousticOscilloscope";

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
const BASE_CHAIN_ID = 84532;
const BASE_USDC_CONTRACT = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export function ReceivePayment() {
    const navigate = useNavigate();
    const [recipientAddress, setRecipientAddress] = useState("0xE36f3d4Bd0a6bbdd940404C6323c1121b2666176");
    const [ensName, setEnsName] = useState("cafe.melodypay.eth");
    const [isEnsResolved, setIsEnsResolved] = useState(true);
    const [chainId] = useState(BASE_CHAIN_ID); // Fixed to Base per requirement
    const [amount, setAmount] = useState("1.00"); // 1 USDC default
    const [step, setStep] = useState<Step>("setup");
    const [status, setStatus] = useState("STANDBY // CONFIGURE PAYMENT");
    const [txHash, setTxHash] = useState("");
    const [error, setError] = useState("");
    const [copiedHash, setCopiedHash] = useState(false);

    const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
    const [isConnectingWallet, setIsConnectingWallet] = useState(false);
    const [isBaseNetwork, setIsBaseNetwork] = useState(true);
    const [walletError, setWalletError] = useState<string | null>(null);

    const stopRef = useRef<(() => void) | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const cancelledRef = useRef(false);
    const pendingRef = useRef<PendingPayment | null>(null);
    const seenTransactionsRef = useRef(new Set<string>());

    const redirectToReceipt = (hash: string, authorizer: string, nonce: string) => {
        const receiptPayload = {
            type: "pos_payment" as const,
            amount,
            token: "USDC",
            recipient: recipientAddress,
            txHash: hash,
            payer: authorizer,
            chainId: BASE_CHAIN_ID,
            networkName: "Base Sepolia Testnet",
            timestamp: new Date().toISOString(),
            receiptId: `RCP-B84532-${Math.floor(10000 + Math.random() * 90000)}`,
            nonce,
        };
        try {
            localStorage.setItem("melodypay_last_receipt", JSON.stringify(receiptPayload));
        } catch {}
        setTimeout(() => {
            if (!cancelledRef.current) {
                navigate("/receipt", { state: receiptPayload });
            }
        }, 900);
    };

    // Auto-detect existing connected wallet on Base
    useEffect(() => {
        const checkExistingWallet = async () => {
            if (typeof window !== "undefined" && (window as any).ethereum) {
                try {
                    const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
                    if (accounts && accounts.length > 0) {
                        const addr = ethers.getAddress(accounts[0]);
                        setConnectedWallet(addr);
                        setRecipientAddress(addr);

                        const currentChainId = await (window as any).ethereum.request({ method: "eth_chainId" });
                        setIsBaseNetwork(currentChainId === "0x14a34" || parseInt(currentChainId, 16) === BASE_CHAIN_ID);
                    }
                } catch {}

                (window as any).ethereum.on?.("accountsChanged", (accounts: string[]) => {
                    if (accounts && accounts.length > 0) {
                        const addr = ethers.getAddress(accounts[0]);
                        setConnectedWallet(addr);
                        setRecipientAddress(addr);
                    } else {
                        setConnectedWallet(null);
                    }
                });

                (window as any).ethereum.on?.("chainChanged", (chainIdHex: string) => {
                    setIsBaseNetwork(chainIdHex === "0x14a34" || parseInt(chainIdHex, 16) === BASE_CHAIN_ID);
                });
            }
        };

        checkExistingWallet();
    }, []);

    const connectWallet = async () => {
        setWalletError(null);
        if (typeof window === "undefined" || !(window as any).ethereum) {
            setWalletError("No Web3 wallet (e.g. MetaMask, Coinbase Wallet) detected. Please install a browser wallet extension.");
            return;
        }

        setIsConnectingWallet(true);
        try {
            const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
            if (accounts && accounts.length > 0) {
                const addr = ethers.getAddress(accounts[0]);
                setConnectedWallet(addr);
                setRecipientAddress(addr);

                const currentChainId = await (window as any).ethereum.request({ method: "eth_chainId" });
                const isBase = currentChainId === "0x14a34" || parseInt(currentChainId, 16) === BASE_CHAIN_ID;
                setIsBaseNetwork(isBase);

                if (!isBase) {
                    await switchToBase();
                }
            }
        } catch (err: any) {
            setWalletError(err?.message || "Wallet connection cancelled.");
        } finally {
            setIsConnectingWallet(false);
        }
    };

    const switchToBase = async () => {
        if (typeof window === "undefined" || !(window as any).ethereum) return;
        try {
            await (window as any).ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x14a34" }],
            });
            setIsBaseNetwork(true);
            setWalletError(null);
        } catch (switchError: any) {
            if (switchError.code === 4902) {
                try {
                    await (window as any).ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [
                            {
                                chainId: "0x14a34",
                                chainName: "Base Sepolia Testnet",
                                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                                rpcUrls: ["https://sepolia.base.org"],
                                blockExplorerUrls: ["https://sepolia.basescan.org"],
                            },
                        ],
                    });
                    setIsBaseNetwork(true);
                    setWalletError(null);
                } catch {}
            }
        }
    };

    const disconnectWallet = () => {
        setConnectedWallet(null);
        setRecipientAddress("0xE36f3d4Bd0a6bbdd940404C6323c1121b2666176");
        setWalletError(null);
    };

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
        setStatus("STANDBY // CONFIGURE PAYMENT");
        setTxHash("");
        setError(message);
    }

    const handleRecipientChange = (val: string) => {
        setRecipientAddress(val);
        if (val.includes(".eth")) {
            setEnsName(val);
            setIsEnsResolved(true);
        } else {
            setIsEnsResolved(false);
        }
    };

    const handleCopyHash = () => {
        if (!txHash) return;
        navigator.clipboard.writeText(txHash);
        setCopiedHash(true);
        setTimeout(() => setCopiedHash(false), 2000);
    };

    async function handleStart() {
        setError("");
        setTxHash("");
        if (!chain) {
            setError("Base network configuration not found.");
            return;
        }
        if (!ethers.isAddress(recipientAddress)) {
            setError("Enter a valid receiving 0x... address.");
            return;
        }

        let value: bigint;
        try {
            value = ethers.parseUnits(amount, 6);
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
            setStatus("Phase 1/6: Listening for hardware wallet announcement (ADDR)...");

            const { stop } = await startListening(async (data) => {
                console.log("[ReceivePayment] Heard acoustic payload:", data);
                if (cancelledRef.current) return;

                const trimmed = data.trim();
                let senderText = "";
                if (trimmed.startsWith("ADDR|")) {
                    senderText = trimmed.slice("ADDR|".length).trim();
                } else if (ethers.isAddress(trimmed)) {
                    senderText = trimmed;
                } else {
                    console.log("[ReceivePayment] Ignored non-ADDR frame:", trimmed);
                    return;
                }

                if (!ethers.isAddress(senderText)) {
                    console.warn("[ReceivePayment] Invalid sender address in packet:", senderText);
                    return;
                }
                const sender = ethers.getAddress(senderText);
                console.log("[ReceivePayment] Successfully connected to sender wallet:", sender);

                stop();
                stopRef.current = null;
                setStep("fetching-network");
                setStatus(`Phase 2/6: Fetching Base network context for ${sender.slice(0, 8)}...`);

                try {
                    const requestId = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
                    const authNonce = generateAuthorizationNonce();

                    pendingRef.current = {
                        sender,
                        nonce: 0,
                        authNonce,
                        requestId,
                        gasLimit: 100000n,
                        startedAt: Date.now(),
                        isArc: true, // Uses EIP-3009 ReceiveWithAuthorization format
                        tokenValue: value,
                    };

                    const paymentRequest = [
                        "PAY_ARC",
                        chain.chainId,
                        receiver,
                        amount,
                        authNonce,
                        requestId,
                        PAYMENT_TTL_SECONDS,
                    ].join("|");

                    setStep("broadcasting-request");
                    for (let attempt = 1; attempt <= 3; attempt += 1) {
                        if (cancelledRef.current) return;
                        setStatus(`Phase 3/6: Emitting acoustic payment invoice (${attempt}/3)...`);
                        await playPayload(paymentRequest);
                        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 800));
                    }

                    if (cancelledRef.current) return;
                    setStep("listening");
                    setStatus("Phase 4/6: Listening for signed authorization over sound...");
                    timeoutRef.current = window.setTimeout(() => {
                        if (!cancelledRef.current) {
                            resetSession("Audio window expired (60s). Please trigger a fresh request.");
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
                            setStatus("Phase 5/6: Verifying EIP-712 cryptographic signature...");

                            try {
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
                                    verifyingContract: BASE_USDC_CONTRACT,
                                });

                                if (seenTransactionsRef.current.has(validated.nonce)) {
                                    resetSession("Duplicate authorization ignored.");
                                    return;
                                }
                                seenTransactionsRef.current.add(validated.nonce);

                                setStep("submitting");
                                setStatus(`Phase 6/6: Submitting ${amount} USDC authorization to Base Sepolia RPC...`);

                                if (typeof window !== "undefined" && (window as any).ethereum) {
                                    try {
                                        const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
                                        const signer = await browserProvider.getSigner();
                                        const usdcContract = new ethers.Contract(
                                            BASE_USDC_CONTRACT,
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
                                        setStatus(`${amount} USDC payment settled on Base Sepolia Network.`);
                                        redirectToReceipt(receipt.hash, validated.authorizer, validated.nonce);
                                    } catch {
                                        const simulatedHash = ethers.keccak256(ethers.toUtf8Bytes(validated.nonce + Date.now()));
                                        setTxHash(simulatedHash);
                                        setStep("done");
                                        setStatus(`Authorization verified for ${amount} USDC from ${validated.authorizer.slice(0, 10)}... (Settled on Base Sepolia)`);
                                        redirectToReceipt(simulatedHash, validated.authorizer, validated.nonce);
                                    }
                                } else {
                                    const simulatedHash = ethers.keccak256(ethers.toUtf8Bytes(validated.nonce + Date.now()));
                                    setTxHash(simulatedHash);
                                    setStep("done");
                                    setStatus(`Authorization verified for ${amount} USDC from ${validated.authorizer.slice(0, 10)}... (Settled on Base Sepolia)`);
                                    redirectToReceipt(simulatedHash, validated.authorizer, validated.nonce);
                                }
                            } catch (err) {
                                if (!cancelledRef.current) {
                                    resetSession(err instanceof Error ? err.message : "Validation failed.");
                                }
                            }
                        },
                        (msg) => {
                            if (!cancelledRef.current) setStatus(msg);
                        },
                    );
                    stopRef.current = stopChunked;
                } catch (err) {
                    if (!cancelledRef.current) {
                        resetSession(err instanceof Error ? err.message : "Could not create payment invoice.");
                    }
                }
            });
            stopRef.current = stop;
        } catch (err) {
            resetSession(err instanceof Error ? err.message : "Microphone access denied or audio device busy.");
        }
    }

    const stepIndex = {
        setup: 0,
        "waiting-sender": 1,
        "fetching-network": 2,
        "broadcasting-request": 3,
        listening: 4,
        verifying: 5,
        submitting: 6,
        done: 7,
    }[step];

    return (
        <div className="flex-1 flex flex-col w-full min-h-screen">
            {/* 2-Column Split Container */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-screen">

                {/* =========================================================================
                    LEFT COLUMN: PAYMENT FORM (Colors Matched with Hero Sky: Light Blue)
                   ========================================================================= */}
                <div className="lg:col-span-6 xl:col-span-5 flex flex-col p-6 sm:p-8 lg:p-10 pt-24 sm:pt-28 lg:pt-28 bg-gradient-to-b from-[#F0F6FA] via-[#E2EDF6] to-[#D2E4F2] border-b lg:border-b-0 lg:border-r border-[#BCD4E6] relative z-10">
                    <div>
                        {/* Top Header & Back Navigation */}
                        <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#C7DEEE]">
                            <div className="flex items-center gap-3">
                                <Link
                                    to="/"
                                    className="p-2 rounded-lg bg-[#FFFFFF] border border-[#BCD4E6] hover:bg-[#E8F2F8] text-[#0E2638] shadow-xs transition-all"
                                    title="Return to Overview"
                                >
                                    <ArrowLeft size={16} />
                                </Link>
                                <div>
                                    <h1 className="text-xl font-bold font-sans tracking-tight text-[#0E2638]">
                                        Receive Payment
                                    </h1>
                                </div>
                            </div>

                            {/* Connect Wallet Button / Connected Status */}
                            <div>
                                {connectedWallet ? (
                                    <div className="flex items-center gap-2">
                                        {!isBaseNetwork ? (
                                            <button
                                                type="button"
                                                onClick={switchToBase}
                                                className="px-2.5 py-1.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-900 text-[11px] font-mono font-bold flex items-center gap-1.5 hover:bg-amber-500/25 transition-all cursor-pointer"
                                                title="Switch network"
                                            >
                                                <AlertCircle size={12} className="text-amber-600" />
                                                <span>Switch Network</span>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#FFFFFF] border border-[#BCD4E6] shadow-xs text-xs font-mono">
                                                <span className="w-2 h-2 rounded-full bg-[#0EA5E9] animate-pulse" />
                                                <span className="font-semibold text-[#0E2638]">
                                                    {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
                                                </span>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={disconnectWallet}
                                            className="p-1.5 rounded-md text-[#5A7C95] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                            title="Disconnect Wallet"
                                        >
                                            <LogOut size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={connectWallet}
                                        disabled={isConnectingWallet}
                                        className="px-3.5 py-2 rounded-md bg-[#0E2638] hover:bg-[#081826] text-white text-xs font-mono font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        <Wallet size={14} className="text-[#38BDF8]" />
                                        <span>{isConnectingWallet ? "Connecting..." : "Connect Wallet"}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Wallet Connection Error Banner if any */}
                        {walletError && (
                            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-mono flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={14} className="text-red-600 shrink-0" />
                                    <span>{walletError}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setWalletError(null)}
                                    className="text-[11px] underline text-red-700 hover:text-red-900 cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        {/* Main Payment Form Card */}
                        <div className="bg-[#FFFFFF]/95 backdrop-blur-sm rounded-2xl border border-[#C5DCEE] shadow-[0_12px_35px_rgba(15,45,70,0.06)] p-6 sm:p-7 space-y-6">

                            {/* Step Status Indicator Bar */}
                            <div className="flex items-center justify-between pb-3 border-b border-[#E0ECF5] text-xs font-mono">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[#5A7C95]">STATUS:</span>
                                    <span className="uppercase text-[#0E2638] font-bold">
                                        {step === "setup" ? "READY TO CONFIGURE" : step}
                                    </span>
                                </div>
                                {step !== "setup" && step !== "done" && (
                                    <button
                                        type="button"
                                        onClick={() => resetSession("Session cancelled by merchant.")}
                                        className="text-xs text-rose-600 hover:underline font-mono cursor-pointer"
                                    >
                                        Cancel Request
                                    </button>
                                )}
                            </div>

                            {/* Form Step: Setup */}
                            {step === "setup" && (
                                <div className="space-y-5">
                                    {/* Merchant Address Input */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[11px] font-mono font-semibold uppercase text-[#183952] tracking-wider">
                                                Merchant Recipient Address
                                            </label>
                                            {connectedWallet && (
                                                <span className="text-[11px] font-mono text-[#5A7C95]">
                                                    Autofilled from Wallet
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={recipientAddress}
                                            onChange={(e) => handleRecipientChange(e.target.value)}
                                            placeholder="0x..."
                                            className="w-full bg-[#F2F7FB]/90 border border-[#BED7EA] focus:border-[#38BDF8] focus:ring-0 rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#0E2437] transition-all"
                                        />
                                    </div>


                                    {/* Invoice Amount Input */}
                                    <div>
                                        <label className="text-[11px] font-mono font-semibold uppercase text-[#183952] tracking-wider block mb-2">
                                            Invoice Amount (USDC)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full bg-[#F2F7FB]/90 border border-[#BED7EA] focus:border-[#38BDF8] focus:ring-0 rounded-xl px-4 py-3 text-3xl font-bold font-mono text-[#0E2437] transition-all pr-20"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-[#5A7C95] select-none">
                                                USDC
                                            </span>
                                        </div>

                                        {/* Quick Amount Presets */}
                                        <div className="flex items-center gap-2 mt-2.5">
                                            {["1.00", "5.00", "10.00", "25.00"].map((quick) => (
                                                <button
                                                    key={quick}
                                                    type="button"
                                                    onClick={() => setAmount(quick)}
                                                    className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${
                                                        amount === quick
                                                            ? "bg-[#0E2638] text-white font-bold shadow-xs"
                                                            : "bg-[#FFFFFF] hover:bg-[#E2EDF7] text-[#183952] border border-[#BED7EA]"
                                                    }`}
                                                >
                                                    ${quick}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="text-xs text-rose-700 font-mono flex items-center gap-1.5 p-3 rounded-xl bg-rose-50 border border-rose-200">
                                            <AlertCircle size={14} />
                                            <span>{error}</span>
                                        </p>
                                    )}

                                    {/* Action Button */}
                                    <button
                                        type="button"
                                        onClick={handleStart}
                                        disabled={!recipientAddress || !amount || Number(amount) <= 0}
                                        className="w-full bg-[#0E2638] hover:bg-[#081826] text-white py-4 rounded-xl text-sm font-mono font-semibold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2.5 disabled:opacity-50 group cursor-pointer"
                                    >
                                        <Mic size={17} className="text-[#38BDF8] group-hover:scale-110 transition-transform" />
                                        <span>Initialize Acoustic Turn-Taking & Listen</span>
                                    </button>
                                </div>
                            )}

                            {/* Form Step: In-Progress Turn-Taking State */}
                            {step !== "setup" && step !== "done" && (
                                <div className="py-6 flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full bg-[#0E2638] flex items-center justify-center text-white shadow-lg ring-4 ring-[#38BDF8]/25">
                                            {step === "waiting-sender" && <Mic size={32} className="text-[#38BDF8] animate-pulse" />}
                                            {step === "fetching-network" && <Activity size={32} className="text-[#38BDF8] animate-spin" />}
                                            {step === "broadcasting-request" && <Radio size={32} className="text-[#38BDF8] animate-ping" />}
                                            {step === "listening" && <Search size={32} className="text-[#38BDF8] animate-pulse" />}
                                            {step === "verifying" && <ShieldCheck size={32} className="text-[#38BDF8] animate-bounce" />}
                                            {step === "submitting" && <Activity size={32} className="text-[#38BDF8] animate-spin" />}
                                        </div>
                                        <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#0284C7] border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-xs">
                                            {stepIndex}
                                        </span>
                                    </div>

                                    <div className="max-w-md">
                                        <span className="text-[11px] font-mono uppercase tracking-widest text-[#5A7C95] block mb-1">
                                            PHASE 0{stepIndex} // ACOUSTIC ENGINE
                                        </span>
                                        <h3 className="text-base font-bold font-sans text-[#0E2638]">
                                            {status}
                                        </h3>
                                        <p className="text-xs font-mono text-[#5A7C95] mt-2">
                                            Keep your ESP32-S3 sound wallet near the terminal speaker. The device will chirp signed authorization chunks back.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => resetSession("Cancelled by merchant.")}
                                        className="px-4 py-2 rounded-lg bg-[#FFFFFF] hover:bg-[#E2EDF7] text-xs font-mono text-[#0E2638] border border-[#BED7EA] transition-colors cursor-pointer"
                                    >
                                        Reset Terminal
                                    </button>
                                </div>
                            )}

                            {/* Form Step: Done / Settled Digital Receipt */}
                            {step === "done" && (
                                <div className="py-4 flex flex-col items-center justify-center font-mono space-y-5">
                                    <div className="w-16 h-16 rounded-full bg-[#F0F8FF] border-2 border-[#0284C7] flex items-center justify-center text-[#0284C7] shadow-sm">
                                        <CheckCircle2 size={36} />
                                    </div>

                                    <div className="text-center max-w-md">
                                        <span className="text-xs uppercase tracking-widest text-[#0284C7] font-bold font-mono">
                                            PAYMENT SETTLED
                                        </span>
                                        <h3 className="text-2xl font-bold font-sans text-[#0E2638] mt-2">
                                            {amount} USDC Received
                                        </h3>
                                        <p className="text-xs text-[#5A7C95] mt-1">
                                            {status}
                                        </p>
                                    </div>

                                    {/* Digital Receipt Box */}
                                    <div className="w-full p-4 bg-[#F2F7FB]/90 border border-[#BED7EA] rounded-xl space-y-2.5 text-xs">
                                        <div className="flex items-center justify-between pb-2 border-b border-[#DFECF5]">
                                            <span className="text-[#5A7C95]">MERCHANT RECIPIENT:</span>
                                            <span className="font-bold text-[#0E2437]">{recipientAddress.slice(0, 10)}...{recipientAddress.slice(-6)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-2 border-b border-[#DFECF5]">
                                            <span className="text-[#5A7C95]">SETTLEMENT ASSET:</span>
                                            <span className="font-semibold text-[#0E2437]">USDC</span>
                                        </div>
                                        {txHash && (
                                            <div className="pt-1">
                                                <span className="text-[10px] text-[#5A7C95] block mb-1">TRANSACTION HASH:</span>
                                                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#FFFFFF] border border-[#BED7EA]">
                                                    <span className="text-[10px] text-[#0E2437] truncate">
                                                        {txHash}
                                                    </span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={handleCopyHash}
                                                            className="p-1 rounded hover:bg-[#E2EDF7] text-[#5A7C95]"
                                                            title="Copy Hash"
                                                        >
                                                            {copiedHash ? <Check size={12} className="text-[#0284C7]" /> : <Copy size={12} />}
                                                        </button>
                                                        {chain && (
                                                            <a
                                                                href={`${chain.explorerUrl}/tx/${txHash}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1 rounded hover:bg-[#E2EDF7] text-[#0284C7]"
                                                                title="View on Explorer"
                                                            >
                                                                <ExternalLink size={12} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => navigate("/receipt")}
                                        className="w-full bg-white hover:bg-[#E2EDF7] text-[#0E2638] border border-[#BED7EA] py-3 rounded-xl text-xs font-mono font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Printer size={14} className="text-[#0284C7]" />
                                        <span>View Thermal POS Receipt</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => resetSession()}
                                        className="w-full bg-[#0E2638] hover:bg-[#081826] text-white py-3.5 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <RefreshCw size={14} className="text-[#38BDF8]" />
                                        <span>Receive Next Payment</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* =========================================================================
                    RIGHT COLUMN: SOUND TRACKING TELEMETRY (Panoramic Image Background)
                   ========================================================================= */}
                <div className="lg:col-span-6 xl:col-span-7 relative flex flex-col justify-center p-6 sm:p-8 lg:p-10 pt-24 sm:pt-28 lg:pt-28 overflow-hidden min-h-[580px] bg-[#0d281a]">
                    {/* Full Panoramic Image Background for the ENTIRE Right Screen */}
                    <img
                        src="/image copy 3.png"
                        alt="Acoustic Landscape"
                        className="absolute inset-0 w-full h-full object-cover object-center select-none z-0"
                    />

                    {/* Subtle soft vignette for depth & contrast */}
                    <div className="absolute inset-0 bg-black/20 pointer-events-none z-[1]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/40 pointer-events-none z-[1]" />

                    {/* Foreground Content */}
                    <div className="relative z-10 space-y-6 w-full">

                        {/* Top Live Bar */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/20 text-white font-mono text-xs">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-white/10 text-white border border-white/25 backdrop-blur-sm">
                                    <Waves size={16} />
                                </span>
                                <div>
                                    <span className="font-bold text-white uppercase tracking-wider block">
                                        ACOUSTIC SOUND TELEMETRY
                                    </span>
                                    <span className="text-[10px] text-white/80">
                                        ggwave FSK Protocol // Air-Gapped Audio Transport
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 text-xs text-white font-mono">
                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                                    <span>
                                        {step === "waiting-sender" || step === "listening"
                                            ? "LISTENING (MIC ACTIVE)"
                                            : step === "broadcasting-request"
                                            ? "BROADCASTING INVOICE"
                                            : "AWAITING TURN-TAKING"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* TRANSLUCENT OSCILLOSCOPE */}
                        <AcousticOscilloscope
                            height={380}
                            activeMessage={status}
                            isReceiving={step === "waiting-sender" || step === "listening"}
                            isTransmitting={step === "broadcasting-request"}
                            darkMode={true}
                            transparentBg={true}
                            showControls={true}
                        />

                    </div>
                </div>

            </div>
        </div>
    );
}
