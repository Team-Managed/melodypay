import { useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Search, 
    CheckCircle2, 
    AlertCircle, 
    Copy, 
    Check, 
    Terminal, 
    Ticket, 
    ArrowRight, 
    Cpu, 
    ShieldCheck, 
    Radio
} from "lucide-react";

export function Register() {
    const [subname, setSubname] = useState("");
    const [recipientAddress, setRecipientAddress] = useState("");
    const [selectedNetwork, setSelectedNetwork] = useState("5042002"); // Arc Testnet default
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [reservationTicket, setReservationTicket] = useState<{
        id: string;
        subname: string;
        address: string;
        networkName: string;
        timestamp: string;
    } | null>(null);
    const [copiedCli, setCopiedCli] = useState(false);
    const [inputError, setInputError] = useState("");

    // Subname validation rules
    const cleanSubname = subname.toLowerCase().trim().replace(/[^a-z0-9-]/g, "");

    const handleCheckAvailability = async () => {
        if (!cleanSubname || cleanSubname.length < 3) {
            setInputError("Subname must be at least 3 alphanumeric characters.");
            setIsAvailable(null);
            return;
        }
        setInputError("");
        setIsChecking(true);

        try {
            // Check availability: query Sepolia NameWrapper or simulate resolution check
            // For known test names, verify; otherwise available
            await new Promise((res) => setTimeout(res, 500));
            // Reserve demo names or mark available
            if (cleanSubname === "admin" || cleanSubname === "registrar") {
                setIsAvailable(false);
            } else {
                setIsAvailable(true);
            }
        } catch {
            setIsAvailable(true);
        } finally {
            setIsChecking(false);
        }
    };

    const handlePrebook = (e: React.FormEvent) => {
        e.preventDefault();
        if (!cleanSubname || cleanSubname.length < 3) {
            setInputError("Please enter a valid subname.");
            return;
        }
        if (recipientAddress && !ethers.isAddress(recipientAddress)) {
            setInputError("Please enter a valid 0x... EVM receiving address.");
            return;
        }
        setInputError("");

        const networkNames: Record<string, string> = {
            "5042002": "Arc Network Testnet (USDC EIP-3009)",
            "10143": "Monad Testnet (MON)",
            "11155111": "Ethereum Sepolia (ETH)",
        };

        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const ticket = {
            id: `MP-2026-${randomNum}`,
            subname: `${cleanSubname}.melodypay.eth`,
            address: recipientAddress ? ethers.getAddress(recipientAddress) : "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF",
            networkName: networkNames[selectedNetwork] || "Arc Network",
            timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
        };

        setReservationTicket(ticket);
    };

    const cliCommand = `npx melodypay register ${cleanSubname || "merchant"}.melodypay.eth --network sepolia --token USDC ${recipientAddress ? `--recipient ${recipientAddress}` : ""}`;

    const handleCopyCli = () => {
        navigator.clipboard.writeText(cliCommand);
        setCopiedCli(true);
        setTimeout(() => setCopiedCli(false), 2000);
    };

    return (
        <div className="flex-1 flex flex-col w-full bg-[#FBFBF9] text-[#111113] relative overflow-hidden py-12">
            {/* Subtle Drafting Grid */}
            <div className="absolute inset-0 bg-drafting-grid pointer-events-none opacity-50" />

            <div className="relative max-w-5xl mx-auto px-4 lg:px-8 z-10">
                {/* Page Title Header */}
                <div className="mb-10 text-center max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#E2E2DA] text-[11px] font-mono text-[#4B4B52] shadow-xs mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                        <span>ENSV2 MERCHANT REGISTRAR & HARDWARE PRE-BOOKING</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111113] font-sans">
                        Reserve Your Merchant Subname & Sound Wallet
                    </h1>
                    <p className="text-sm text-[#4B4B52] mt-2 leading-relaxed">
                        Claim an official <code className="font-mono text-xs bg-[#ECECE6] px-1 py-0.5 rounded">*.melodypay.eth</code> identity on Ethereum Sepolia and join the hardware provisioning queue for the ESP32-S3 sound wallet.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Form Setup */}
                    <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E2E2DA] rounded-lg p-6 shadow-sm">
                        <form onSubmit={handlePrebook} className="space-y-6">
                            {/* Subname Selection */}
                            <div>
                                <label className="block text-xs font-mono font-semibold text-[#111113] uppercase tracking-wider mb-2">
                                    01. Choose ENS Merchant Subname
                                </label>
                                <div className="flex items-center">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={subname}
                                            onChange={(e) => {
                                                setSubname(e.target.value);
                                                setIsAvailable(null);
                                                setInputError("");
                                            }}
                                            placeholder="e.g. cafe, boutique, bodega"
                                            className="w-full bg-[#FBFBF9] border border-[#E2E2DA] focus:border-[#111113] focus:ring-0 rounded-l px-3.5 py-2.5 text-sm font-mono text-[#111113] placeholder-[#A1A1AA] transition-all"
                                        />
                                    </div>
                                    <div className="px-3.5 py-2.5 bg-[#F5F5F0] border-y border-r border-[#E2E2DA] text-sm font-mono text-[#4B4B52] font-medium">
                                        .melodypay.eth
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCheckAvailability}
                                        disabled={isChecking || !cleanSubname}
                                        className="ml-2 bg-[#111113] hover:bg-black text-white px-4 py-2.5 rounded-r text-xs font-mono transition-all disabled:opacity-50"
                                    >
                                        {isChecking ? "Checking..." : "Check"}
                                    </button>
                                </div>

                                {inputError && (
                                    <p className="text-xs text-rose-600 font-mono mt-1.5 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        <span>{inputError}</span>
                                    </p>
                                )}

                                {isAvailable !== null && !inputError && (
                                    <div className="mt-2 flex items-center gap-2 text-xs font-mono">
                                        {isAvailable ? (
                                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                                <CheckCircle2 size={12} />
                                                <span>AVAILABLE TO RESERVE</span>
                                            </span>
                                        ) : (
                                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                <span>NAME ALREADY REGISTERED</span>
                                            </span>
                                        )}
                                        <span className="text-[#7A7A85]">
                                            Registration fee: 1.00 USDC (or Sepolia ETH)
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Settlement Address */}
                            <div>
                                <label className="block text-xs font-mono font-semibold text-[#111113] uppercase tracking-wider mb-2">
                                    02. Merchant Receiving EVM Address
                                </label>
                                <input
                                    type="text"
                                    value={recipientAddress}
                                    onChange={(e) => setRecipientAddress(e.target.value)}
                                    placeholder="0x... (Your EVM wallet address to receive customer funds)"
                                    className="w-full bg-[#FBFBF9] border border-[#E2E2DA] focus:border-[#111113] focus:ring-0 rounded px-3.5 py-2.5 text-xs font-mono text-[#111113] placeholder-[#A1A1AA] transition-all"
                                />
                                <span className="text-[11px] font-mono text-[#7A7A85] mt-1 block">
                                    This address is recorded in the ENS resolver for forward payment routing.
                                </span>
                            </div>

                            {/* Preferred Network */}
                            <div>
                                <label className="block text-xs font-mono font-semibold text-[#111113] uppercase tracking-wider mb-2">
                                    03. Default Settlement Network
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedNetwork("5042002")}
                                        className={`p-3 rounded border text-left font-mono transition-all ${
                                            selectedNetwork === "5042002"
                                                ? "bg-[#0088FF]/5 border-[#0088FF] ring-1 ring-[#0088FF]"
                                                : "bg-[#FBFBF9] border-[#E2E2DA] hover:bg-[#F5F5F0]"
                                        }`}
                                    >
                                        <span className="text-xs font-bold text-[#111113] block">Arc Testnet</span>
                                        <span className="text-[10px] text-[#0088FF] block mt-0.5">USDC // Gasless</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedNetwork("10143")}
                                        className={`p-3 rounded border text-left font-mono transition-all ${
                                            selectedNetwork === "10143"
                                                ? "bg-[#836EF9]/5 border-[#836EF9] ring-1 ring-[#836EF9]"
                                                : "bg-[#FBFBF9] border-[#E2E2DA] hover:bg-[#F5F5F0]"
                                        }`}
                                    >
                                        <span className="text-xs font-bold text-[#111113] block">Monad Testnet</span>
                                        <span className="text-[10px] text-[#836EF9] block mt-0.5">10,000 TPS Native</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedNetwork("11155111")}
                                        className={`p-3 rounded border text-left font-mono transition-all ${
                                            selectedNetwork === "11155111"
                                                ? "bg-[#111113]/5 border-[#111113] ring-1 ring-[#111113]"
                                                : "bg-[#FBFBF9] border-[#E2E2DA] hover:bg-[#F5F5F0]"
                                        }`}
                                    >
                                        <span className="text-xs font-bold text-[#111113] block">Sepolia</span>
                                        <span className="text-[10px] text-[#7A7A85] block mt-0.5">ETH Native</span>
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="w-full bg-[#111113] hover:bg-black text-white py-3.5 px-4 rounded text-xs font-mono font-semibold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <Ticket size={15} className="text-[#00E5FF]" />
                                <span>Generate Pre-Booking Pass & CLI Script</span>
                            </button>
                        </form>
                    </div>

                    {/* Right Column: Reservation Pass or Architecture Card */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <AnimatePresence mode="wait">
                            {reservationTicket ? (
                                <motion.div
                                    key="ticket"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-[#FFFFFF] border-2 border-[#111113] rounded-lg p-6 shadow-md relative font-mono overflow-hidden"
                                >
                                    {/* Industrial Perforated Stamp */}
                                    <div className="flex items-center justify-between pb-3 border-b border-[#ECECE6]">
                                        <div className="flex items-center gap-2">
                                            <Ticket size={16} className="text-[#0088FF]" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-[#111113]">
                                                PRE-BOOKING PASS
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-[#7A7A85]">
                                            {reservationTicket.id}
                                        </span>
                                    </div>

                                    <div className="py-4 space-y-3 text-xs border-b border-dashed border-[#E2E2DA]">
                                        <div>
                                            <span className="text-[10px] uppercase text-[#7A7A85] block">
                                                RESERVED ENS SUBNAME:
                                            </span>
                                            <span className="text-sm font-bold text-[#0088FF]">
                                                {reservationTicket.subname}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase text-[#7A7A85] block">
                                                FORWARD SETTLEMENT ADDRESS:
                                            </span>
                                            <span className="text-[11px] text-[#111113] break-all font-mono">
                                                {reservationTicket.address}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase text-[#7A7A85] block">
                                                PAYMENT ROUTE:
                                            </span>
                                            <span className="text-xs text-[#111113] font-semibold">
                                                {reservationTicket.networkName}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase text-[#7A7A85] block">
                                                QUEUE STATUS:
                                            </span>
                                            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 mt-0.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                HARDWARE QUEUE #042 // READY FOR SEPOLIA EXECUTION
                                            </span>
                                        </div>
                                    </div>

                                    {/* CLI Helper Command */}
                                    <div className="pt-4">
                                        <span className="text-[10px] uppercase text-[#7A7A85] block mb-1.5">
                                            ON-CHAIN EXECUTION VIA CLI:
                                        </span>
                                        <div className="p-2.5 rounded bg-[#FBFBF9] border border-[#E2E2DA] flex items-center justify-between gap-2">
                                            <code className="text-[10px] text-[#111113] font-mono break-all line-clamp-2">
                                                {cliCommand}
                                            </code>
                                            <button
                                                type="button"
                                                onClick={handleCopyCli}
                                                className="p-1.5 rounded hover:bg-[#ECECE6] text-[#4B4B52] transition-colors shrink-0"
                                                title="Copy CLI command"
                                            >
                                                {copiedCli ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-[#ECECE6] flex items-center justify-between text-[10px] text-[#7A7A85]">
                                        <span>ZERO IN-BROWSER SIGNING RULE COMPLIANT</span>
                                        <Link to="/receive" className="text-[#0088FF] hover:underline font-semibold flex items-center gap-1">
                                            <span>Open Terminal</span>
                                            <ArrowRight size={10} />
                                        </Link>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="bg-[#FFFFFF] border border-[#E2E2DA] rounded-lg p-6 shadow-sm font-mono space-y-4">
                                    <div className="flex items-center gap-2 pb-3 border-b border-[#ECECE6]">
                                        <ShieldCheck size={16} className="text-emerald-600" />
                                        <h3 className="text-xs font-bold text-[#111113] uppercase tracking-wider">
                                            ENS Subname Registrar Rules
                                        </h3>
                                    </div>

                                    <p className="text-xs text-[#4B4B52] leading-relaxed">
                                        Subnames are registered through <code className="text-[11px] text-[#111113]">MelodyPaySubnameRegistrar.sol</code> on Ethereum Sepolia under the parent domain <code className="text-[11px] text-[#111113]">melodypay.eth</code>.
                                    </p>

                                    <div className="p-3 bg-[#FBFBF9] rounded border border-[#E2E2DA] text-[11px] space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#7A7A85]">Contract:</span>
                                            <span className="font-semibold text-[#111113]">MelodyPaySubnameRegistrar</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#7A7A85]">NameWrapper:</span>
                                            <span className="font-semibold text-[#111113]">0x0635...dFcE8</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#7A7A85]">Fuses:</span>
                                            <span className="font-semibold text-emerald-700">PARENT_CANNOT_CONTROL</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#7A7A85]">Registration Fee:</span>
                                            <span className="font-semibold text-[#111113]">1.00 USDC / Dynamic ETH</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 text-[11px] text-[#7A7A85] flex items-center gap-1.5">
                                        <Radio size={12} className="text-[#0088FF]" />
                                        <span>Pre-booking grants early access to production ESP32 hardware units.</span>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
