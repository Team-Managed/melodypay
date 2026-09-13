import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, CheckCircle2, Copy, ExternalLink, Printer, RefreshCw, ShieldCheck, Waves } from "lucide-react";
import { getChainConfig } from "../core/chains";
import { MelodyPayStaffRibbon } from "../components/MelodyPayStaffRibbon";

export interface ReceiptData {
    type: "pos_payment" | "prebooking";
    amount: string;
    token: string;
    recipient: string;
    txHash: string;
    payer?: string;
    chainId?: number | string;
    networkName?: string;
    timestamp?: string;
    receiptId?: string;
    nonce?: string;
    quantity?: number;
}

const RECEIPT_STORAGE_KEY = "melodypay_last_receipt";

function isReceiptData(value: unknown): value is ReceiptData {
    if (!value || typeof value !== "object") return false;
    const receipt = value as Partial<ReceiptData>;
    return (
        (receipt.type === "pos_payment" || receipt.type === "prebooking") &&
        typeof receipt.amount === "string" &&
        typeof receipt.token === "string" &&
        typeof receipt.recipient === "string" &&
        typeof receipt.txHash === "string" &&
        receipt.txHash.length > 0
    );
}

export function PaymentReceipt() {
    const location = useLocation();
    const navigate = useNavigate();
    const receiptContainerRef = useRef<HTMLDivElement>(null);
    const [receipt, setReceipt] = useState<ReceiptData | null>(null);
    const [isPrinting, setIsPrinting] = useState(true);
    const [feedKey, setFeedKey] = useState(0);
    const [copiedHash, setCopiedHash] = useState(false);

    useEffect(() => {
        const navigationState = location.state as unknown;
        const stateReceipt = navigationState && typeof navigationState === "object" && "receipt" in navigationState
            ? (navigationState as { receipt: unknown }).receipt
            : navigationState;
        let storedReceipt: unknown = null;
        try {
            storedReceipt = JSON.parse(localStorage.getItem(RECEIPT_STORAGE_KEY) || "null");
        } catch {
            storedReceipt = null;
        }

        if (isReceiptData(stateReceipt)) {
            setReceipt(stateReceipt);
            localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(stateReceipt));
        } else if (isReceiptData(storedReceipt)) {
            setReceipt(storedReceipt);
        } else {
            navigate("/receive", { replace: true });
        }
    }, [location.state, navigate]);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsPrinting(false), 2400);
        return () => window.clearTimeout(timer);
    }, [feedKey]);

    if (!receipt) return null;
    const currentReceipt = receipt;

    const chainId = Number(receipt.chainId || 0);
    const chain = getChainConfig(chainId);
    const explorerUrl = chain?.explorerUrl
        ? `${chain.explorerUrl}/tx/${receipt.txHash}`
        : chainId === 11155111
            ? `https://sepolia.etherscan.io/tx/${receipt.txHash}`
            : `https://basescan.org/tx/${receipt.txHash}`;
    const formattedDate = receipt.timestamp
        ? new Date(receipt.timestamp).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        })
        : "Timestamp unavailable";
    const settlementLabel = receipt.type === "prebooking" ? "HARDWARE PRE-BOOKED" : "PAYMENT SETTLED";
    const networkLabel = receipt.networkName || chain?.name || `Chain ${chainId || "unknown"}`;

    function replayFeed() {
        setIsPrinting(true);
        setFeedKey((current) => current + 1);
    }

    async function copyHash() {
        await navigator.clipboard.writeText(currentReceipt.txHash);
        setCopiedHash(true);
        window.setTimeout(() => setCopiedHash(false), 2000);
    }

    return (
        <main className="relative flex min-h-screen w-full items-start justify-center overflow-x-hidden overflow-y-auto px-4 pb-10 pt-28 text-white sm:px-6 sm:pt-32 lg:px-10 lg:pb-12 lg:pt-28">
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #printable-receipt-card, #printable-receipt-card * { visibility: visible !important; }
                    #printable-receipt-card { position: absolute !important; left: 0 !important; top: 0 !important; width: 80mm !important; max-width: 80mm !important; margin: 0 !important; box-shadow: none !important; }
                }
            `}</style>

            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0d281a]">
                <img src="/image copy 3.png" alt="" className="h-full w-full scale-105 object-cover object-center opacity-60 blur-[4px]" />
                <div className="absolute inset-0 bg-[#0d281a]/60" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50" />
                <div className="absolute inset-0 flex items-center justify-center opacity-45">
                    <div className="h-[70vh] w-[120vw] min-w-[1000px]">
                        <MelodyPayStaffRibbon className="h-full w-full" showControls={false} />
                    </div>
                </div>
            </div>

            <div className="relative z-10 w-full max-w-[430px]">
                <div className="mb-4 flex items-center justify-between text-xs text-white/70">
                    <Link to="/" className="transition hover:text-white">← Back to overview</Link>
                    <div className="flex items-center gap-2 font-mono uppercase tracking-wider"><Waves size={13} className="text-sky-200" /> On-chain receipt</div>
                </div>

                <div className="overflow-hidden rounded-t-2xl border-x-2 border-t-2 border-[#2f3a48] bg-[#181d24] shadow-[0_25px_50px_rgba(0,0,0,0.6)]">
                    <div className="relative border-b border-[#0d1117] bg-gradient-to-b from-[#28323e] via-[#1e2630] to-[#151b22] p-3 shadow-inner">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 rounded border border-[#2b3645] bg-[#0d1217] px-2 py-1 shadow-inner">
                                <span className="rounded bg-[#1c2430] p-0.5 text-sky-300"><Waves size={11} /></span>
                                <span className="text-[10px] font-mono font-bold tracking-widest text-[#e2e8f0]">MELODYPAY</span>
                                <span className="text-[8px] font-mono font-semibold text-[#64748b]">TM-88</span>
                            </div>
                            <div className="flex items-center gap-2 rounded border border-[#202935] bg-[#0a0e13] px-2 py-1 text-[8px] font-mono shadow-inner">
                                <span className="flex items-center gap-1 text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" /> POWER</span>
                                <span className="flex items-center gap-1 text-sky-300"><span className={`h-1.5 w-1.5 rounded-full bg-sky-400 ${isPrinting ? "animate-ping" : ""}`} /> DATA</span>
                            </div>
                            <button type="button" onClick={replayFeed} className="flex items-center gap-1 rounded border border-[#3c4c60] bg-[#25303d] px-2 py-1 text-[8px] font-mono font-bold tracking-wider text-[#cbd5e1] transition hover:bg-[#303e4f]" title="Replay receipt feed"><RefreshCw size={10} /> FEED</button>
                        </div>
                        <div className="mt-2 h-0.5 w-full rounded-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                    </div>
                    <div className="relative border-b-2 border-[#1b222c] bg-[#090c10] p-2 shadow-[inset_0_8px_16px_rgba(0,0,0,0.9)]">
                        <div className="h-3 rounded bg-gradient-to-b from-[#e2e8f0] via-[#94a3b8] to-[#64748b] shadow-md" />
                        <div className="mt-1 h-3.5 rounded border border-[#141a22] bg-[#040608]" />
                    </div>
                </div>

                <div className="relative -mt-0.5 flex w-full flex-col items-center overflow-hidden">
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-4 bg-gradient-to-b from-black/50 via-black/15 to-transparent" />
                    <motion.div
                        key={feedKey}
                        id="printable-receipt-card"
                        ref={receiptContainerRef}
                        initial={{ y: "-105%" }}
                        animate={{ y: 0 }}
                        transition={{ duration: 2.4, ease: [0.25, 0.1, 0.25, 1] }}
                        className="relative flex w-full flex-col bg-[#fcfdfd] font-mono text-[#11161b] shadow-[0_25px_60px_rgba(0,0,0,0.4)]"
                    >
                        <div className="h-2.5 w-full bg-[linear-gradient(135deg,transparent_25%,#161c24_25%,#161c24_50%,transparent_50%,transparent_75%,#161c24_75%)] bg-[length:16px_10px]" />
                        <div className="space-y-3 px-5 py-4 sm:px-6">
                            <div className="border-b border-dashed border-[#a0b4c4] pb-2 text-center">
                                <h1 className="text-sm font-bold uppercase tracking-tight text-[#0a1826] sm:text-base">MelodyPay Payment Receipt</h1>
                                <p className="mt-1 text-[9px] uppercase tracking-wider text-[#69889f]">Acoustic POS // Cryptographic settlement</p>
                            </div>

                            <div className="space-y-0.5 rounded-lg border border-[#cbddeb] bg-[#eef5fa] px-3 py-2 text-center">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800"><CheckCircle2 size={13} className="text-emerald-600" /> {settlementLabel}</span>
                                <div className="py-1 text-2xl font-bold leading-none tracking-tight text-[#0a1826]">{receipt.amount} {receipt.token}</div>
                                <span className="block text-[9px] uppercase tracking-wider text-[#5a7b94]">{networkLabel}</span>
                            </div>

                            <div className="space-y-1 border-b border-dashed border-[#a0b4c4] pb-2.5 text-[11px]">
                                <div className="flex items-center justify-between text-[#5a7b94]"><span>RECEIPT NO:</span><span className="font-bold text-[#0a1826]">{receipt.receiptId || "MELODYPAY"}</span></div>
                                <div className="flex items-center justify-between text-[#5a7b94]"><span>DATE & TIME:</span><span className="font-semibold text-[#0a1826]">{formattedDate}</span></div>
                                <div className="flex items-center justify-between text-[#5a7b94]"><span>NETWORK:</span><span className="font-semibold text-[#0a1826]">{networkLabel} ({chainId || "?"})</span></div>
                                <div className="flex items-center justify-between gap-3 text-[#5a7b94]"><span>RECIPIENT:</span><span className="truncate font-mono text-[10px] text-[#0a1826]">{receipt.recipient.slice(0, 8)}...{receipt.recipient.slice(-6)}</span></div>
                                {receipt.payer && <div className="flex items-center justify-between gap-3 text-[#5a7b94]"><span>PAYER:</span><span className="font-mono text-[10px] text-[#0a1826]">{receipt.payer.slice(0, 8)}...{receipt.payer.slice(-6)}</span></div>}
                                {receipt.quantity && <div className="flex items-center justify-between text-[#5a7b94]"><span>HARDWARE UNITS:</span><span className="font-bold text-[#0a1826]">{receipt.quantity}x HardWallet</span></div>}
                            </div>

                            <div className="flex items-center justify-between gap-2 rounded border border-[#cbddeb] bg-[#eef5fa] p-2 text-[10px]">
                                <span className="font-bold text-[#5a7b94]">TX HASH:</span>
                                <span className="truncate text-[#0a1826]">{receipt.txHash.slice(0, 12)}...{receipt.txHash.slice(-8)}</span>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button type="button" onClick={copyHash} className="rounded p-1 text-[#486b85] transition hover:bg-[#dde9f2]" title="Copy transaction hash">{copiedHash ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}</button>
                                    <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-[#0284c7] transition hover:bg-[#dde9f2]" title="View on explorer"><ExternalLink size={12} /></a>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-b border-dashed border-[#a0b4c4] pb-2 text-[10px] text-[#5a7b94]"><span className="flex items-center gap-1.5 font-bold text-[#0a1826]"><ShieldCheck size={13} className="text-emerald-600" /> AIR-GAP VERIFIED</span><span className="text-[9px]">NO EMAIL REQUIRED</span></div>
                            <div className="flex flex-col items-center justify-center pt-1">
                                <div className="flex h-8 w-full items-center justify-between overflow-hidden px-1 opacity-80">{[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 4, 1, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3].map((width, index) => <span key={index} className="h-full bg-[#11161b]" style={{ width: `${width * 2}px` }} />)}</div>
                                <span className="mt-1 text-[9px] tracking-wider text-[#69889f]">* {receipt.receiptId || "MP-RECEIPT"} *</span>
                            </div>
                            <div className="pt-1 text-center text-[9px] uppercase tracking-wider text-[#69889f]">THANK YOU FOR PAYING WITH SOUND<br /><strong>PAID WITH MELODYPAY</strong></div>
                        </div>
                        <div className="h-2.5 w-full bg-[linear-gradient(45deg,transparent_25%,#fcfdfd_25%,#fcfdfd_50%,transparent_50%,transparent_75%,#fcfdfd_75%)] bg-[length:16px_10px]" />
                    </motion.div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-semibold text-[#111113] transition hover:bg-sky-50"><Printer size={14} /> Print receipt</button>
                    <button type="button" onClick={replayFeed} className="flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 py-3 text-xs font-semibold text-white transition hover:bg-white/20"><RefreshCw size={14} /> Replay feed</button>
                </div>
                <Link to={receipt.type === "prebooking" ? "/register" : "/receive"} className="mt-3 block text-center text-xs text-white/65 transition hover:text-white">Start another {receipt.type === "prebooking" ? "prebooking" : "payment"} →</Link>
            </div>
        </main>
    );
}
