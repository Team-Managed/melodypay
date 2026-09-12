import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
    Radio, 
    ArrowUpRight, 
    Cpu, 
    CheckCircle2, 
    ExternalLink 
} from "lucide-react";
import { PayForSoundStaffRibbon } from "../components/PayForSoundStaffRibbon";
import { MelodyPayStaffRibbon } from "../components/MelodyPayStaffRibbon";
import { AcousticOscilloscope } from "../components/AcousticOscilloscope";
import { HardwareTeardown } from "../components/HardwareTeardown";

export function Home() {
    return (
        <div className="flex-1 flex flex-col w-full bg-[#FBFBF9] text-[#111113] relative overflow-hidden font-sans selection:bg-[#836EF9]/20 selection:text-[#111113]">
            {/* FULL-WIDTH HERO SECTION: CINEMATIC PANORAMIC IMAGE COVERS SCREEN & SPACE BEHIND NAVBAR */}
            <section className="relative w-full overflow-hidden">
                {/* Full-width screen-covering background image with space behind navbar */}
                <div className="relative w-full h-[420px] sm:h-[500px] lg:h-[580px] overflow-hidden bg-[#0d281a]">
                    {/* Background image: fills container absolutely */}
                    <img
                        src="/image copy 3.png"
                        alt="MelodyPay Landscape Panorama"
                        className="absolute inset-0 w-full h-full object-cover object-center select-none z-0"
                    />

                    {/* Subtle soft vignette ensuring natural landscape photo stays bright and pristine */}
                    <div className="absolute inset-0 bg-black/[0.12] pointer-events-none z-[1]" />

                    {/* Overlaid Delicate Cursive 'Pay with sound' Calligraphy Stave */}
                    <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">
                        <PayForSoundStaffRibbon className="w-full h-full" showControls={false} />
                    </div>
                </div>

                {/* EDITORIAL TYPOGRAPHY SPLIT ROW (CLEAN CUT DIRECTLY BELOW THE FULL-WIDTH IMAGE) */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
                    {/* Left Column: Bold, Crisp Editorial Headline (Refined Scale) */}
                    <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="lg:col-span-7 flex flex-col items-start text-left"
                    >
                        <span className="text-[11px] font-mono text-[#0088FF] uppercase tracking-[0.22em] font-semibold mb-3">
                            // AIR-GAPPED SOUND WIRE
                        </span>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.75rem] font-bold tracking-tight text-[#111113] font-sans leading-[1.12]">
                            Air-gapped by sound.<br />
                            <span className="text-[#4B4B52] font-normal">Sign offline. Settle on-chain.</span>
                        </h1>
                    </motion.div>

                    {/* Right Column: Short and Crisp Explanatory Paragraph + Architectural Rectangular CTA */}
                    <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="lg:col-span-5 flex flex-col items-start pt-2 text-left"
                    >
                        <p className="text-sm sm:text-base text-[#4B4B52] leading-relaxed mb-6 font-sans">
                            Sound waves as an air-gapped financial wire. Offline hardware signs transactions with physical button confirmation, settled instantly on-chain via keyless terminals.
                        </p>

                        <div className="flex items-center gap-4 flex-wrap">
                            <Link
                                to="/receive"
                                className="bg-[#111113] hover:bg-black text-white px-7 py-3 rounded-md text-sm font-sans font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2 group cursor-pointer"
                            >
                                <span>Launch Terminal</span>
                                <ArrowUpRight size={15} className="text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </Link>

                            <Link
                                to="/register"
                                className="text-sm font-mono text-[#4B4B52] hover:text-[#111113] transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <span>Pre-book Device & ENS ➔</span>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* TICKER TELEMETRY STRIP */}
            <div className="w-full py-3.5 bg-[#F5F5F0] text-[#111113] border-y border-[#E2E2DA] overflow-hidden z-20">
                <div className="flex w-max font-mono text-xs font-medium animate-marquee">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center shrink-0">
                            {[
                                "AIR-GAPPED ACOUSTIC WIRE",
                                "MULTICHAIN EVM SETTLEMENT",
                                "ENSV2 MERCHANT REGISTRAR",
                                "ESP32-S3 PHYSICAL SIGNER",
                                "INMP441 I2S INVOICE CAPTURE",
                                "GASLESS EIP-3009 TRANSFERS",
                                "KEYLESS UNTRUSTED RECEIVER",
                                "LEDGER CLEAR-SIGNING COMPATIBLE"
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center">
                                    <span className="mx-8 tracking-widest uppercase text-[11px] text-[#111113]/80 font-semibold">
                                        {item}
                                    </span>
                                    <span className="text-[#0088FF] opacity-60">•</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* FEATURES SECTION: 3D EXPLODED HARDWARE TEARDOWN */}
            <section id="hardware" className="relative w-full max-w-7xl mx-auto px-4 lg:px-8 py-20 z-10 scroll-mt-20">
                <div className="mb-10 text-center max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 text-xs font-mono text-[#0088FF] uppercase tracking-wider mb-2 px-3 py-1 rounded-md bg-[#0088FF]/10 border border-[#0088FF]/20">
                        <Cpu size={14} />
                        <span>HARDWARE ARCHITECTURE & SILICON TEARDOWN</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111113] font-sans">
                        See Through the Hardware
                    </h2>
                    <p className="text-sm text-[#4B4B52] mt-2 leading-relaxed">
                        Scroll through to explode and inspect every physical module in 3D. 
                        The device never touches the internet, never exports private keys, and enforces human confirmation.
                    </p>
                </div>

                <HardwareTeardown />
            </section>

            {/* INTERACTIVE OSCILLOSCOPE TELEMETRY BENCH */}
            <section id="oscilloscope" className="relative w-full max-w-7xl mx-auto px-4 lg:px-8 py-16 z-10 border-t border-[#E2E2DA] scroll-mt-24">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-[#0088FF] uppercase tracking-wider mb-1">
                            <Radio size={14} />
                            <span>LIVE ACOUSTIC SPECTRUM ANALYSIS</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111113] font-sans">
                            Real-Time Acoustic Telemetry
                        </h2>
                    </div>
                    <div className="text-xs font-mono text-[#7A7A85]">
                        EIP-3009 PROTOCOL FREQUENCY: <strong className="text-[#111113]">1875 Hz – 2187 Hz</strong>
                    </div>
                </div>

                <AcousticOscilloscope 
                    height={180} 
                    activeMessage="AWAITING AUDIO TRANSMISSION BURST // 48.0 kHz SAMPLING"
                />
            </section>

            {/* MULTI-CHAIN & SPONSOR ECOSYSTEM MATRIX */}
            <section id="ecosystem" className="relative w-full max-w-7xl mx-auto px-4 lg:px-8 py-16 z-10 border-t border-[#E2E2DA] scroll-mt-24">
                <div className="mb-10 text-center max-w-2xl mx-auto">
                    <span className="text-xs font-mono text-[#836EF9] uppercase tracking-wider block mb-2">
                        [ECOSYSTEM MATRIX]
                    </span>
                    <h2 className="text-3xl font-bold tracking-tight text-[#111113] font-sans">
                        Multi-Chain & Smart Contract Infrastructure
                    </h2>
                    <p className="text-sm text-[#4B4B52] mt-2">
                        MelodyPay utilizes specialized smart contracts across multiple networks to enforce identity, prevent replay attacks, and settle payments natively.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Arc Network */}
                    <div className="p-5 bg-[#FFFFFF] rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded bg-[#0088FF]/10 text-[#0088FF] font-mono text-xs font-semibold">
                                    ARC NETWORK
                                </span>
                                <span className="text-[10px] font-mono text-[#7A7A85]">CHAIN 5042002</span>
                            </div>
                            <h3 className="text-base font-bold text-[#111113] mb-2 font-sans">
                                Canonical USDC Settlement
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                Settles acoustic payments via Arc's native USDC precompile (<code className="text-[11px] font-mono text-[#111113] bg-[#F5F5F0] px-1 py-0.5 rounded">0x36...00</code>). Uses EIP-3009 <code className="text-[11px] font-mono text-[#111113] bg-[#F5F5F0] px-1 py-0.5 rounded">receiveWithAuthorization</code> where the merchant pays the gas.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-emerald-600 flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            <span>Customer Gas: $0.00</span>
                        </div>
                    </div>

                    {/* ENSv2 Sepolia */}
                    <div className="p-5 bg-[#FFFFFF] rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded bg-neutral-100 text-[#111113] font-mono text-xs font-semibold">
                                    ENSV2 SEPOLIA
                                </span>
                                <span className="text-[10px] font-mono text-[#7A7A85]">CHAIN 11155111</span>
                            </div>
                            <h3 className="text-base font-bold text-[#111113] mb-2 font-sans">
                                Merchant Subname Registrar
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                Real ENS NameWrapper integration via <code className="text-[11px] font-mono text-[#111113] bg-[#F5F5F0] px-1 py-0.5 rounded">MelodyPaySubnameRegistrar.sol</code> issuing emancipated subnames under <code className="text-[11px] font-mono text-[#111113] bg-[#F5F5F0] px-1 py-0.5 rounded">melodypay.eth</code> with Arc routing text records.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-[#111113] flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            <span>Emancipated ERC-1155</span>
                        </div>
                    </div>

                    {/* Monad Testnet */}
                    <div className="p-5 bg-[#FFFFFF] rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded bg-[#836EF9]/10 text-[#836EF9] font-mono text-xs font-semibold">
                                    MONAD TESTNET
                                </span>
                                <span className="text-[10px] font-mono text-[#7A7A85]">CHAIN 10143</span>
                            </div>
                            <h3 className="text-base font-bold text-[#111113] mb-2 font-sans">
                                High-Speed Sound Transfers
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                Sub-second finality transfers on Monad with EIP-1559 acoustic transaction encoding. Hardware wallet enforces gas ceilings to protect against charge-on-gas-limit models.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-[#836EF9] flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            <span>10,000 TPS Acoustic Settlement</span>
                        </div>
                    </div>

                    {/* Hardware Signer Boundary */}
                    <div className="p-5 bg-[#FFFFFF] rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-xs font-semibold">
                                    SILICON AIR-GAP
                                </span>
                                <span className="text-[10px] font-mono text-[#7A7A85]">ESP32-S3</span>
                            </div>
                            <h3 className="text-base font-bold text-[#111113] mb-2 font-sans">
                                Zero-Internet Device
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                All transaction signing happens inside the ESP32-S3 physical enclave. Cryptographic signatures are emitted exclusively as ultrasonic / audible acoustic audio packets.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-emerald-600 flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            <span>No Network Interfaces</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* PROTOCOL SIGNATURE RIBBON FOOTER SECTION */}
            <footer id="protocol" className="relative w-full bg-[#F5F5F0] border-t border-[#E2E2DA] pt-16 pb-12 overflow-hidden scroll-mt-24">
                {/* 5-Line Musical Stave Cursive 'melodypay' Ribbon Wave */}
                <div className="w-full h-44 sm:h-52 relative mb-6">
                    <MelodyPayStaffRibbon />
                </div>

                <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E2E2DA] text-xs font-mono text-[#4B4B52]">
                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-[#111113]">MelodyPay Protocol</span>
                        <span>•</span>
                        <span>Acoustic Wire Standard // EIP-3009</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <Link to="/receive" className="hover:text-[#111113] transition-colors">POS Terminal</Link>
                        <Link to="/register" className="hover:text-[#111113] transition-colors">Register Subname</Link>
                        <a href="https://github.com/tyraakj/melodypay" target="_blank" rel="noreferrer" className="hover:text-[#111113] transition-colors flex items-center gap-1">
                            GitHub <ExternalLink size={12} />
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
