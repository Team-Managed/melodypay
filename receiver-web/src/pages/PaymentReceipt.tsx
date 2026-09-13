import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Copy,
    Check,
    ExternalLink,
    CheckCircle2,
    ShieldCheck,
    Waves
} from "lucide-react";
import { getChainConfig } from "../core/chains";
import { MelodyPayStaffRibbon } from "../components/MelodyPayStaffRibbon";

export interface ReceiptData {
    type: "pos_payment" | "ens_registration" | "prebooking";
    amount: string;
    token: string;
    recipient: string;
    txHash: string;
    payer?: string;
    chainId?: number | string;
    networkName?: string;
    timestamp?: string;
    receiptId?: string;
    subname?: string;
    nonce?: string;
    queueNumber?: string;
    quantity?: number;
}



export function PaymentReceipt() {
    const location = useLocation();
    const navigate = useNavigate();
    const [receipt, setReceipt] = useState<ReceiptData | null>(null);
    const [isPrinting, setIsPrinting] = useState(true);
    const [feedKey, setFeedKey] = useState(0);
    const [copiedHash, setCopiedHash] = useState(false);
    const receiptContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 1. Check navigation state
        if (location.state && (location.state as ReceiptData).amount) {
            const data = location.state as ReceiptData;
            setReceipt(data);
            try {
                localStorage.setItem("melodypay_last_receipt", JSON.stringify(data));
            } catch {}
        } else {
            // 2. Fall back to localStorage (e.g. after a page refresh)
            try {
                const stored = localStorage.getItem("melodypay_last_receipt");
                if (stored) {
                    setReceipt(JSON.parse(stored));
                } else {
                    // No real receipt data — send the user back to pre-book
                    navigate("/register", { replace: true });
                }
            } catch {
                navigate("/register", { replace: true });
            }
        }

        // Mechanical printer completion timer
        const timer = setTimeout(() => {
            setIsPrinting(false);
        }, 2400);

        return () => clearTimeout(timer);
    }, [location.state, feedKey, navigate]);

    const handleTriggerFeed = () => {
        setIsPrinting(true);
        setFeedKey((prev) => prev + 1);
    };

    if (!receipt) return null;

    const chainIdNum = Number(receipt.chainId || 8453);
    const chainConfig = getChainConfig(chainIdNum);
    const explorerUrl = chainConfig?.explorerUrl
        ? `${chainConfig.explorerUrl}/tx/${receipt.txHash}`
        : receipt.chainId === 11155111
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
        : new Date().toISOString();

    const handleCopyHash = () => {
        navigator.clipboard.writeText(receipt.txHash);
        setCopiedHash(true);
        setTimeout(() => setCopiedHash(false), 2000);
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-start lg:justify-center w-full min-h-screen lg:h-screen lg:max-h-screen relative overflow-x-hidden overflow-y-auto lg:overflow-hidden text-[#111113] pt-20 sm:pt-24 pb-8 lg:pb-4">
            {/* Global Print-Only CSS */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-receipt-card, #printable-receipt-card * {
                        visibility: visible !important;
                    }
                    #printable-receipt-card {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 80mm !important;
                        margin: 0 auto !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                }
            `}</style>

            {/* =========================================================================
                BACKGROUND: HERO IMAGE BLURRED + MELODYPAY WAVE ANIMATION
               ========================================================================= */}
            {/* 1. Blurred Hero Panoramic Photo */}
            <img
                src="/image copy 3.png"
                alt="Acoustic Landscape Background"
                className="absolute inset-0 w-full h-full object-cover object-center select-none filter blur-[7px] scale-105 pointer-events-none z-0"
            />

            {/* 2. Dark forest vignette wash for crisp readability */}
            <div className="absolute inset-0 bg-[#0d281a]/55 backdrop-blur-[1px] pointer-events-none z-[1]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/45 pointer-events-none z-[1]" />

            {/* 3. Cursive Spencerian "MelodyPay" Animated Musical Staff Ribbon (Enlarged & Prominent) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-[2] opacity-75">
                <div className="w-[120vw] h-[100vh] min-w-[1350px] flex items-center justify-center scale-125 sm:scale-135 md:scale-150 origin-center">
                    <MelodyPayStaffRibbon className="w-full h-full" showControls={false} />
                </div>
            </div>

            {/* =========================================================================
                FOREGROUND: CENTERED PRINTER & ELONGATED THERMAL RECEIPT
               ========================================================================= */}
            <div className="relative z-10 w-full max-w-[390px] sm:max-w-[420px] flex flex-col items-center justify-center px-4 py-2 sm:py-3">

                {/* =========================================================================
                    REALISTIC THERMAL POS PRINTER CHASSIS (Skeuomorphic Hardware Design)
                   ========================================================================= */}
                <div className="w-full bg-[#181D24] rounded-t-2xl border-t-2 border-x-2 border-[#2F3A48] shadow-[0_25px_50px_rgba(0,0,0,0.6),0_10px_20px_rgba(0,0,0,0.4)] relative z-20 overflow-hidden">
                    {/* Top Hood / Paper Roll Chamber (Curved Bevel Lid) */}
                    <div className="bg-gradient-to-b from-[#28323E] via-[#1E2630] to-[#151B22] p-3 border-b border-[#0D1117] relative shadow-inner">
                        <div className="flex items-center justify-between">
                            {/* Brand Emblem Plate */}
                            <div className="flex items-center gap-2">
                                <div className="px-2 py-0.5 rounded bg-[#0D1217] border border-[#2B3645] shadow-inner flex items-center gap-1.5">
                                    <span className="p-0.5 rounded bg-[#1C2430] text-[#38BDF8]">
                                        <Waves size={11} />
                                    </span>
                                    <span className="text-[10px] font-mono font-bold tracking-widest text-[#E2E8F0] uppercase">
                                        MELODYPAY
                                    </span>
                                    <span className="text-[8px] font-mono text-[#64748B] font-semibold">
                                        TM-88
                                    </span>
                                </div>
                            </div>

                            {/* LED Status Cluster (Silkscreen labeled) */}
                            <div className="flex items-center gap-3 px-2 py-1 rounded bg-[#0A0E13] border border-[#202935] shadow-inner text-[8px] font-mono select-none">
                                <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                                    <span className="text-[#94A3B8] font-bold">POWER</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                            isPrinting
                                                ? "bg-[#38BDF8] animate-ping shadow-[0_0_8px_rgba(56,189,248,1)]"
                                                : "bg-[#38BDF8]/40"
                                        }`}
                                    />
                                    <span className={isPrinting ? "text-[#38BDF8] font-bold" : "text-[#64748B]"}>
                                        DATA
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#242D38]" />
                                    <span className="text-[#475569]">ERROR</span>
                                </div>
                            </div>

                            {/* Tactile FEED Button */}
                            <button
                                type="button"
                                onClick={handleTriggerFeed}
                                className="px-2 py-1 rounded bg-[#25303D] hover:bg-[#303E4F] border border-[#3C4C60] shadow-xs text-[8px] font-mono text-[#CBD5E1] font-bold uppercase tracking-wider flex items-center gap-1 active:translate-y-0.5 transition-all cursor-pointer"
                                title="Press FEED to re-run printer animation"
                            >
                                <span className="w-1 h-1 rounded-full bg-[#38BDF8]" />
                                <span>FEED</span>
                            </button>
                        </div>

                        {/* Paper roll chamber curved highlight seam */}
                        <div className="mt-2 h-0.5 w-full bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-full" />
                    </div>

                    {/* Recessed Dispenser Mouth & Stainless Steel Cutter Blade */}
                    <div className="bg-[#090C10] p-2 relative shadow-[inset_0_8px_16px_rgba(0,0,0,0.9)] border-b-2 border-[#1B222C]">
                        {/* Metallic Stainless Steel Serrated Tear Blade */}
                        <div className="h-3 w-full bg-gradient-to-b from-[#E2E8F0] via-[#94A3B8] to-[#64748B] rounded-xs shadow-md flex items-center justify-between px-2 relative border-t border-white/60">
                            {/* Serrated metallic micro-teeth along the cutter edge */}
                            <div className="absolute inset-x-0 -bottom-1 h-1 flex justify-between overflow-hidden opacity-90 pointer-events-none">
                                {Array.from({ length: 36 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1.5 h-1 bg-[#64748B]"
                                        style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }}
                                    />
                                ))}
                            </div>
                            <span className="text-[7px] font-mono text-[#0F172A] font-extrabold tracking-widest uppercase select-none">
                                STAINLESS CUTTER // TEAR BAR
                            </span>
                            <span className="text-[7px] font-mono text-[#334155] font-bold">
                                80mm THERMAL
                            </span>
                        </div>

                        {/* Deep Paper Dispenser Slot & Rubber Roller */}
                        <div className="mt-1 h-3.5 bg-[#040608] rounded-xs relative flex items-center justify-center overflow-hidden border border-[#141A22]">
                            {/* Rubber Platen Roller Cylinder visible inside slot */}
                            <div className="absolute inset-x-2 h-2 bg-[#12161B] rounded-full border border-black/80 shadow-inner flex items-center justify-around opacity-75">
                                <div className="w-full h-0.5 bg-black/60" />
                            </div>

                            {/* Active thermal print-head scanning effect */}
                            {isPrinting && (
                                <motion.div
                                    animate={{ opacity: [0.3, 1, 0.3], scaleX: [0.6, 1.05, 0.6] }}
                                    transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
                                    className="w-24 h-1 bg-[#38BDF8] blur-xs shadow-[0_0_12px_rgba(56,189,248,1)] z-10"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* =========================================================================
                    ANIMATED RECEIPT PAPER (Feeds Downward Out of Printer Slit)
                   ========================================================================= */}
                <div className="w-full relative -mt-0.5 z-10 overflow-hidden flex flex-col items-center">
                    {/* Realistic Paper Slit Deep Shadow (Simulating physical depth as paper rolls from internal chamber) */}
                    <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-black/50 via-black/15 to-transparent pointer-events-none z-30" />

                    <motion.div
                        key={feedKey}
                        id="printable-receipt-card"
                        ref={receiptContainerRef}
                        initial={{ y: "-100%" }}
                        animate={{ y: 0 }}
                        transition={{
                            duration: 2.4,
                            ease: [0.25, 0.1, 0.25, 1], // Smooth mechanical continuous feed easing
                        }}
                        style={{ willChange: "transform", transformOrigin: "top center" }}
                        className="w-full bg-[#FCFDFD] text-[#11161B] shadow-[0_25px_60px_rgba(0,0,0,0.4)] border-x border-[#D3DFE8] relative flex flex-col font-mono"
                    >
                        {/* Top Saw-Tooth Tear Line */}
                        <div className="w-full h-2.5 overflow-hidden leading-none select-none text-[#161C24] -mt-0.5">
                            <svg
                                viewBox="0 0 400 10"
                                preserveAspectRatio="none"
                                className="w-full h-2.5 fill-current"
                            >
                                <path d="M0,0 L10,10 L20,0 L30,10 L40,0 L50,10 L60,0 L70,10 L80,0 L90,10 L100,0 L110,10 L120,0 L130,10 L140,0 L150,10 L160,0 L170,10 L180,0 L190,10 L200,0 L210,10 L220,0 L230,10 L240,0 L250,10 L260,0 L270,10 L280,0 L290,10 L300,0 L310,10 L320,0 L330,10 L340,0 L350,10 L360,0 L370,10 L380,0 L390,10 L400,0 L400,10 L0,10 Z" />
                            </svg>
                        </div>

                        {/* Interior Thermal Body (Longer, Generous Spacing) */}
                        <div className="px-5 sm:px-6 py-4 space-y-3">

                            {/* Header Brandmark */}
                            <div className="text-center border-b border-dashed border-[#A0B4C4] pb-2">
                                <h2 className="text-sm sm:text-base font-bold tracking-tight text-[#0A1826] uppercase">
                                    Melodypay Payment Receipt
                                </h2>
                            </div>

                            {/* Settlement Stamp Box */}
                            <div className="py-2 px-3 bg-[#EEF5FA] border border-[#CBDDEB] rounded-lg text-center space-y-0.5">
                                <span className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-800">
                                    <CheckCircle2 size={13} className="text-emerald-600" />
                                    <span>
                                        {receipt.type === "prebooking"
                                            ? "PREBOOKED"
                                            : receipt.type === "ens_registration"
                                            ? "SUBDOMAIN RESERVED"
                                            : "PAYMENT SETTLED & VERIFIED"}
                                    </span>
                                </span>
                                <div className="text-2xl font-bold tracking-tight text-[#0A1826] leading-none py-1">
                                    {receipt.amount} {receipt.token}
                                </div>
                                <span className="text-[9px] uppercase tracking-wider text-[#5A7B94] block">
                                    {receipt.type === "prebooking"
                                        ? "HARDWARE PRE-BOOKING // BASE MAINNET"
                                        : receipt.type === "ens_registration"
                                        ? "ETH SEPOLIA NAMEWRAPPER"
                                         : "GASLESS SETTLEMENT // 0x8335...2913"}
                                </span>
                            </div>

                            {/* Detailed Metadata Grid */}
                            <div className="space-y-1 text-[11px] border-b border-dashed border-[#A0B4C4] pb-2.5">
                                <div className="flex items-center justify-between text-[#5A7B94]">
                                    <span>RECEIPT NO:</span>
                                    <span className="font-bold text-[#0A1826]">{receipt.receiptId || "RCP-BASE-78241"}</span>
                                </div>

                                <div className="flex items-center justify-between text-[#5A7B94]">
                                    <span>DATE & TIME:</span>
                                    <span className="font-semibold text-[#0A1826]">{formattedDate}</span>
                                </div>

                                <div className="flex items-center justify-between text-[#5A7B94]">
                                    <span>SETTLEMENT ASSET:</span>
                                    <span className="font-bold text-[#0A1826]">Native {receipt.token}</span>
                                </div>

                                <div className="flex items-center justify-between text-[#5A7B94]">
                                    <span>NETWORK:</span>
                                    <span className="font-semibold text-[#0A1826]">
                                        {receipt.networkName || "Base Mainnet"} ({receipt.chainId || 8453})
                                    </span>
                                </div>

                                {receipt.type === "prebooking" && (
                                    <>
                                        <div className="flex items-center justify-between text-[#5A7B94]">
                                            <span>ORDER STATUS:</span>
                                            <span className="font-bold text-emerald-700 font-mono tracking-wider">PREBOOKED</span>
                                        </div>
                                        {receipt.quantity && receipt.quantity > 0 && (
                                            <div className="flex items-center justify-between text-[#5A7B94]">
                                                <span>HARDWARE UNITS:</span>
                                                <span className="font-bold text-[#0A1826]">{receipt.quantity}x MelodyPay HardWallet</span>
                                            </div>
                                        )}
                                    </>
                                )}

                                {receipt.subname && (
                                    <div className="flex items-center justify-between text-[#5A7B94]">
                                        <span>RESERVED SUBNAME:</span>
                                        <span className="font-bold text-[#0284C7] truncate max-w-[200px]">{receipt.subname}</span>
                                    </div>
                                )}

                                {receipt.payer && (
                                    <div className="flex items-center justify-between text-[#5A7B94]">
                                        <span>PAYER WALLET:</span>
                                        <span className="font-mono text-[10px] text-[#0A1826]">
                                            {receipt.payer.slice(0, 8)}...{receipt.payer.slice(-6)}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-[#5A7B94]">
                                    <span>MERCHANT VAULT:</span>
                                    <span className="font-mono text-[10px] text-[#0A1826]">
                                        {receipt.recipient.slice(0, 8)}...{receipt.recipient.slice(-6)}
                                    </span>
                                </div>
                            </div>

                            {/* On-Chain Tx Hash Section */}
                            <div className="p-2 rounded bg-[#EEF5FA] border border-[#CBDDEB] flex items-center justify-between gap-1.5 text-[10px]">
                                <span className="text-[#5A7B94] font-bold">TX HASH:</span>
                                <span className="text-[10px] text-[#0A1826] font-mono truncate max-w-[190px]">
                                    {receipt.txHash.slice(0, 12)}...{receipt.txHash.slice(-8)}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleCopyHash}
                                        className="p-1 rounded hover:bg-[#DDE9F2] text-[#486B85] transition-colors cursor-pointer"
                                        title="Copy Transaction Hash"
                                    >
                                        {copiedHash ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                    </button>
                                    <a
                                        href={explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded hover:bg-[#DDE9F2] text-[#0284C7] transition-colors cursor-pointer"
                                        title="View on Explorer"
                                    >
                                        <ExternalLink size={12} />
                                    </a>
                                </div>
                            </div>

                            {/* Acoustic Hardware Proof */}
                            <div className="flex items-center justify-between text-[10px] text-[#5A7B94] border-b border-dashed border-[#A0B4C4] pb-2">
                                <div className="flex items-center gap-1.5 font-bold text-[#0A1826]">
                                    <ShieldCheck size={13} className="text-emerald-600" />
                                    <span>AIR-GAP ACOUSTIC VERIFIED</span>
                                </div>
                                <span className="text-[9px] text-[#7895A9]">ZERO KEYS EXPOSED</span>
                            </div>

                            {/* Thermal Barcode Graphic */}
                            <div className="flex flex-col items-center justify-center pt-1">
                                <div className="w-full h-8 flex items-center justify-between px-1 opacity-80 select-none overflow-hidden">
                                    {[
                                        3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 4, 1, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 4
                                    ].map((w, i) => (
                                        <div
                                            key={i}
                                            className="h-full bg-[#11161B]"
                                            style={{ width: `${w * 2}px` }}
                                        />
                                    ))}
                                </div>
                                <span className="text-[9px] text-[#69889F] font-mono tracking-wider mt-1">
                                    * {receipt.receiptId || "MP-2026-8453"} *
                                </span>
                            </div>

                            {/* Tear Line Indicator */}
                            <div className="text-center text-[9px] text-[#8DA6BA] select-none pt-1">
                                <span>✂ - - - - - - - - - - - - - - - - - - - - - - - ✂</span>
                            </div>

                            <div className="text-center pt-1 pb-1">
                                <span className="text-[9px] text-[#69889F] uppercase tracking-wider block">
                                    THANK YOU FOR PAYING WITH SOUND
                                </span>
                                <span className="text-[9px] text-[#5A7B94] font-bold uppercase tracking-wider block">
                                    PAID WITH MELODYPAY
                                </span>
                            </div>
                        </div>

                        {/* Bottom Saw-Tooth Tear Edge */}
                        <div className="w-full h-2.5 overflow-hidden leading-none select-none text-[#FCFDFD] -mb-0.5 rotate-180">
                            <svg
                                viewBox="0 0 400 10"
                                preserveAspectRatio="none"
                                className="w-full h-2.5 fill-black/40"
                            >
                                <path d="M0,0 L10,10 L20,0 L30,10 L40,0 L50,10 L60,0 L70,10 L80,0 L90,10 L100,0 L110,10 L120,0 L130,10 L140,0 L150,10 L160,0 L170,10 L180,0 L190,10 L200,0 L210,10 L220,0 L230,10 L240,0 L250,10 L260,0 L270,10 L280,0 L290,10 L300,0 L310,10 L320,0 L330,10 L340,0 L350,10 L360,0 L370,10 L380,0 L390,10 L400,0 L400,10 L0,10 Z" />
                            </svg>
                        </div>
                    </motion.div>
                </div>

            </div>
        </div>
    );
}
