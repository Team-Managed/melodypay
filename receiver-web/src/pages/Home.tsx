import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { 
    Radio, 
    ArrowUpRight, 
    Cpu, 
    CheckCircle2, 
    ExternalLink,
    ShieldCheck,
    Zap,
    ChevronDown,
    Lock,
    Activity,
    Sparkles,
    ChevronRight,
    ChevronLeft,
    Mic,
    Volume2,
    Shield,
    Terminal,
    ArrowRight,
    Check,
    WifiOff,
    Smartphone,
    Layers,
    Waves
} from "lucide-react";
import { PayForSoundStaffRibbon } from "../components/PayForSoundStaffRibbon";
import { MelodyPayStaffRibbon } from "../components/MelodyPayStaffRibbon";
import { Hardware3DScene } from "../components/3d/Hardware3DScene";
import { MelodyLogoM } from "../components/MelodyLogoM";

interface PrototypeFeature {
    id: number;
    step: string;
    title: string;
    subtitle: string;
    tag: string;
    desc: string;
    bus: string;
    security: string;
    repo: string;
    partKey: string;
}

const PROTOTYPE_FEATURES: PrototypeFeature[] = [
    {
        id: 1,
        step: "01",
        title: "ESP32-S3 Dual-Core SoC",
        subtitle: "Air-Gapped Cryptographic Core",
        tag: "AIR-GAPPED SILICON CORE",
        desc: "Xtensa 32-bit LX7 @ 240MHz executing secure secp256k1 signing. Wi-Fi and Bluetooth stacks are permanently stripped at compile-time to maintain an absolute physical air-gap.",
        bus: "240 MHz Xtensa LX7 // 512KB SRAM // 8MB Flash",
        security: "Fail-closed signing boundary. Zero radio drivers loaded into memory.",
        repo: "esp32/firmware/signing",
        partKey: "mcu"
    },
    {
        id: 2,
        step: "02",
        title: "INMP441 Omnidirectional Microphone",
        subtitle: "Acoustic Invoice Capture Sensor",
        tag: "ACOUSTIC INVOICE CAPTURE SENSOR",
        desc: "High-precision 24-bit I2S digital MEMS microphone listening for incoming merchant audio chimes. Streams raw 48.0 kHz acoustic audio directly to memory via digital I2S, immune to analog noise.",
        bus: "SD: GPIO 4 // WS: GPIO 5 // SCK: GPIO 6",
        security: "Hardware-isolated receive pipeline; no audio recorded to persistent flash.",
        repo: "esp32/components/audio_hal",
        partKey: "mic"
    },
    {
        id: 3,
        step: "03",
        title: "Tactile Intent Confirmation Switches",
        subtitle: "Zero-Software Physical Interlock",
        tag: "ZERO-SOFTWARE PHYSICAL INTERLOCK",
        desc: "Hardware interlock requiring physical human confirmation. Green button authorizes secp256k1 signature generation; red button immediately aborts transaction and purges ephemeral buffers.",
        bus: "CONFIRM: GPIO 18 // CANCEL: GPIO 19",
        security: "Physical interrupt gate. Signature cannot be authorized via API or serial without button debounce signal.",
        repo: "esp32/components/buttons",
        partKey: "buttons"
    },
    {
        id: 4,
        step: "04",
        title: "MAX98357A I2S DAC & Audio Amp",
        subtitle: "Acoustic Signature Transmitter",
        tag: "ACOUSTIC SIGNATURE TRANSMITTER",
        desc: "Class-D amplifier driving the speaker to emit the ggwave FSK acoustic signature packet back to the merchant's microphone within 400ms.",
        bus: "LRC: GPIO 7 // BCLK: GPIO 8 // DIN: GPIO 9",
        security: "Emits bounded chunks (max 128 bytes) with 300ms inter-burst silence for clean synchronization.",
        repo: "esp32/components/audio_hal",
        partKey: "amp"
    },
    {
        id: 5,
        step: "05",
        title: "0.96\" Monochrome OLED Display",
        subtitle: "Tamper-Proof Clear-Signing Screen",
        tag: "TAMPER-PROOF CLEAR-SIGNING",
        desc: "SSD1306 display showing real-time acoustic telemetry and human-verified transaction data: exact payment amount, verified merchant recipient address, and one-time transaction nonce.",
        bus: "I2C SDA: GPIO 21 // SCL: GPIO 22 // 128x64 px",
        security: "Strictly forbids multi-page truncation or hidden calldata; rejects signing if address does not fit.",
        repo: "esp32/components/oled",
        partKey: "oled"
    },
];

const FAQS = [
    {
        q: "Can acoustic sound payments be recorded and replayed?",
        a: "No. Every acoustic payment carries a cryptographically unique one-time authorization nonce, a 60-second expiration window (validBefore), and the merchant's specific recipient address. Once settled on-chain, that nonce is permanently invalidated. Any recorded or repeated playback is rejected by the smart contract as an invalid duplicate nonce."
    },
    {
        q: "How does payment settlement work?",
        a: "MelodyPay settles transactions directly on-chain with instant finality. The offline HardWallet cryptographically signs the payment payload over the acoustic air-gap, and the merchant's connected terminal broadcasts the signed transaction with sub-second finality and negligible network fees."
    },
    {
        q: "What if the ambient environment is extremely noisy?",
        a: "MelodyPay uses ggwave audio modems engineered with Reed-Solomon Forward Error Correction (FEC). The protocol can reconstruct corrupted or clipped audio packets with up to 25% missing data, ensuring reliable demodulation in busy restaurants, cafes, and outdoor environments."
    },
    {
        q: "Why use acoustic sound waves instead of NFC or QR codes?",
        a: "NFC requires specialized reader chips, close physical proximity (< 4 cm), and is vulnerable to relay attacks. QR codes require line-of-sight camera alignment, proper lighting, and clean lenses. Sound waves propagate omnidirectionally through the air, require zero physical contact or optical alignment, and function on any standard smartphone or laptop microphone."
    },
    {
        q: "Which assets and networks are supported?",
        a: "MelodyPay is engineered for instant on-chain settlement with high-throughput finality. All acoustic payments transfer directly to the merchant's on-chain address with sub-second finality."
    },
    {
        q: "How does the CLI communicate with the ESP32 hardware wallet over USB?",
        a: "The MelodyPay CLI connects over USB serial at 115200 baud using a structured, line-oriented JSON protocol (api <json>). It queries device capabilities (device.status), runs hardware self-tests (audio.self_test, ggwave.self_test, display.text), and configures active chains in NVS. Crucially, the firmware signing boundary remains capability-reported and fail-closed—keys are never exported over serial."
    },
    {
        q: "Is private key material exposed when managing the device over USB serial?",
        a: "Never. The structured control protocol enforces capability reporting and fail-closed security. Firmware commands only query status, run peripheral self-tests, and save non-secret network configuration (active chain ID) in NVS. The firmware contains zero commands to export or print private keys."
    },
    {
        q: "Is the hardware and firmware completely open-source?",
        a: "Yes. The complete ESP32-S3 firmware, FreeRTOS audio pipelines, I2S driver configurations, smart contracts, web POS app, and standalone CLI terminal are 100% open-source under the MIT license in our GitHub repository. Anyone can build their own device using off-the-shelf maker components."
    }
];

export function Home() {
    // Active staircase feature index (0 to 4)
    const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
    const [direction, setDirection] = useState(1);
    const prototypeContainerRef = useRef<HTMLDivElement | null>(null);
    const activeIndexRef = useRef(activeFeatureIndex);
    // Active FAQ index
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    useEffect(() => {
        activeIndexRef.current = activeFeatureIndex;
    }, [activeFeatureIndex]);

    // Sticky Scroll Progress: Track 300vh container
    // The screen sticks to the viewport from "start start" until "end end" (until the last feature is covered)
    const { scrollYProgress } = useScroll({
        target: prototypeContainerRef,
        offset: ["start start", "end end"]
    });

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        if (typeof window !== "undefined" && window.innerWidth < 1024) return;
        let targetIndex = 0;
        if (latest >= 0.80) {
            targetIndex = 4;
        } else if (latest >= 0.60) {
            targetIndex = 3;
        } else if (latest >= 0.40) {
            targetIndex = 2;
        } else if (latest >= 0.20) {
            targetIndex = 1;
        } else {
            targetIndex = 0;
        }

        if (targetIndex !== activeIndexRef.current) {
            setDirection(targetIndex > activeIndexRef.current ? 1 : -1);
            setActiveFeatureIndex(targetIndex);
        }
    });

    // Smoothly scroll to a specific step when clicking step number on the staircase rail
    const scrollToStep = (targetIndex: number) => {
        setDirection(targetIndex > activeIndexRef.current ? 1 : -1);
        setActiveFeatureIndex(targetIndex);

        if (typeof window !== "undefined" && window.innerWidth >= 1024 && prototypeContainerRef.current) {
            const rect = prototypeContainerRef.current.getBoundingClientRect();
            const scrollTop = window.scrollY + rect.top;
            const scrollDistance = prototypeContainerRef.current.offsetHeight - window.innerHeight;
            if (scrollDistance > 0) {
                const targetProgress = (targetIndex / 4) * 0.96;
                const targetScrollY = scrollTop + (targetProgress * scrollDistance);
                window.scrollTo({ top: targetScrollY, behavior: "smooth" });
            }
        }
    };

    // Synchronize 3D mesh click to staircase feature and scroll
    const handle3DPartSelect = (partName: string) => {
        const lower = partName.toLowerCase();
        let targetIndex = -1;
        if (lower.includes("esp32") || lower.includes("mcu")) targetIndex = 0;
        else if (lower.includes("mic") || lower.includes("inmp")) targetIndex = 1;
        else if (lower.includes("button") || lower.includes("switch")) targetIndex = 2;
        else if (lower.includes("speaker") || lower.includes("amp")) targetIndex = 3;
        else if (lower.includes("oled") || lower.includes("screen") || lower.includes("display")) targetIndex = 4;

        if (targetIndex !== -1 && targetIndex !== activeFeatureIndex) {
            scrollToStep(targetIndex);
        }
    };

    const currentFeature = PROTOTYPE_FEATURES[activeFeatureIndex];

    return (
        <div className="flex-1 flex flex-col w-full bg-[#FBFBF9] text-[#111113] relative overflow-x-clip font-sans selection:bg-[#836EF9]/20 selection:text-[#111113]">
            {/* =========================================================================
                1. FULL-WIDTH HERO SECTION: CINEMATIC PANORAMIC IMAGE & SPLIT EDITORIAL
               ========================================================================= */}
            <section className="relative w-full overflow-hidden">
                {/* Full-width screen-covering background image with space behind navbar */}
                <div className="relative w-full h-[420px] sm:h-[500px] lg:h-[580px] overflow-hidden bg-[#0d281a]">
                    <img
                        src="/image copy 3.png"
                        alt="MelodyPay Landscape Panorama"
                        className="absolute inset-0 w-full h-full object-cover object-center select-none z-0"
                    />

                    {/* Subtle soft vignette */}
                    <div className="absolute inset-0 bg-black/[0.12] pointer-events-none z-[1]" />

                    {/* Overlaid Delicate Cursive 'Pay with sound' Calligraphy Stave */}
                    <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">
                        <PayForSoundStaffRibbon className="w-full h-full" showControls={false} />
                    </div>
                </div>

                {/* EDITORIAL TYPOGRAPHY SPLIT ROW */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
                    {/* Left Column: Bold Editorial Headline */}
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

                    {/* Right Column: Explanatory Paragraph + CTAs */}
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
                                <span>Receive Payments</span>
                                <ArrowUpRight size={15} className="text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </Link>

                            <Link
                                to="/register"
                                className="text-sm font-mono text-[#4B4B52] hover:text-[#111113] transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <span>Pre-book MelodyPay HardWallet ➔</span>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>


            {/* =========================================================================
                2. FEATURES SECTION: RECEIVER GLASSMORPHIC ARCHITECTURAL MATRIX
               ========================================================================= */}
            <section id="features" className="relative w-full py-24 sm:py-28 z-10 scroll-mt-20 overflow-hidden">
                {/* Full-Bleed Meadow with Birds Aerial Background (Matching Receiver & Register Pages) */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <img
                        src="/image copy 2.png"
                        alt="Meadow Aerial Backdrop"
                        className="w-full h-full object-cover object-[center_75%] select-none scale-105"
                    />
                    {/* Soft ambient vignette & darkening for superior contrast and readability */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/60 pointer-events-none" />
                    <div className="absolute inset-0 bg-[#0d281a]/25 backdrop-blur-[0.5px] pointer-events-none" />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Section Header - Clean Editorial Layout with Soft Vignette Backdrop */}
                    <div className="mb-14 lg:mb-16 text-center max-w-4xl lg:max-w-5xl mx-auto relative">
                        {/* Clean soft backdrop glow to ensure zero visual clash between background elements and text */}
                        <div className="absolute inset-0 -inset-x-12 -inset-y-6 bg-black/40 rounded-3xl blur-2xl pointer-events-none -z-10" />

                        <span className="text-[11px] font-mono text-[#38BDF8] uppercase tracking-[0.22em] font-semibold mb-2.5 block drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                            // PROTOCOL CAPABILITIES
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.65rem] font-bold tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] font-sans leading-[1.2]">
                            <span className="block sm:whitespace-nowrap">Engineered for Sovereign Money.</span>
                            <span className="block sm:whitespace-nowrap text-white/85 font-normal text-xl sm:text-2xl md:text-3xl lg:text-[2.15rem] mt-1 sm:mt-1.5">
                                Air-gapped acoustic wire. Instant settlement.
                            </span>
                        </h2>
                        <p className="text-sm sm:text-base font-sans text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] mt-3 leading-relaxed max-w-xl mx-auto">
                            Zero radio emissions, physical hardware confirmation, and instant settlement.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
                        {/* Glassmorphic Tile 1: (lg:col-span-7) Acoustic Air-Gap Physical Wire */}
                        <div className="lg:col-span-7 p-7 sm:p-8 bg-white/[0.07] backdrop-blur-2xl border border-white/25 ring-1 ring-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] hover:border-white/40 hover:bg-white/[0.10] transition-all flex flex-col justify-between group relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 text-[#38BDF8] flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                                        <WifiOff size={22} />
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white font-mono text-[10px] uppercase font-semibold flex items-center gap-1.5 shadow-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            0.00 mW RF Radiation
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/30 text-[#38BDF8] font-mono text-[10px] uppercase font-semibold">
                                            1875 – 2187 Hz FSK
                                        </span>
                                    </div>
                                </div>

                                <span className="text-xs font-mono text-[#38BDF8] uppercase tracking-wider font-semibold block mb-1">
                                    PHYSICAL TRANSMISSION LAYER
                                </span>
                                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 font-sans">
                                    Acoustic Air-Gap Wire
                                </h3>
                                <p className="text-sm text-white/75 leading-relaxed mb-6 font-sans max-w-xl">
                                    Completely eliminates Bluetooth, Wi-Fi, and NFC attack surfaces. Encrypted payment payloads travel strictly through airborne acoustic waves via ggwave FSK audio modulation—physically immune to radio snooping, relay exploits, and wireless interception.
                                </p>
                            </div>

                            {/* Visual Frequency Band / Carrier Waveform Simulation in Dark Glass */}
                            <div className="mt-4 p-4 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 relative overflow-hidden shadow-inner">
                                <div className="flex items-center justify-between text-[11px] font-mono text-white/80 mb-3">
                                    <span className="flex items-center gap-1.5">
                                        <Radio size={13} className="text-[#38BDF8]" />
                                        <span>CARRIER FREQUENCY SPECTRUM</span>
                                    </span>
                                    <span className="text-emerald-400 font-semibold">AIR-GAP VERIFIED</span>
                                </div>

                                <div className="h-16 flex items-end justify-between gap-1.5 px-2">
                                    {[35, 50, 25, 70, 90, 60, 45, 80, 100, 75, 40, 65, 85, 55, 30, 70, 95, 45, 60, 80].map((h, i) => (
                                        <motion.div
                                            key={i}
                                            className="flex-1 bg-gradient-to-t from-[#0088FF] via-[#38BDF8] to-emerald-400 rounded-t-sm shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                                            animate={{ height: [`${h}%`, `${Math.max(15, (h * 1.3) % 100)}%`, `${h}%`] }}
                                            transition={{
                                                duration: 1.8,
                                                repeat: Infinity,
                                                delay: i * 0.08,
                                                ease: "easeInOut"
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/60">
                                    <span>1875 Hz (Carrier Start)</span>
                                    <span>Center: 2031 Hz</span>
                                    <span>2187 Hz (Signature Peak)</span>
                                </div>
                            </div>

                            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-white/70">
                                <span className="flex items-center gap-1.5">
                                    <ShieldCheck size={14} className="text-emerald-400" />
                                    <span>Transmission: Ambient Sound Waves</span>
                                </span>
                                <span className="text-white font-semibold">128B Ephemeral Payloads</span>
                            </div>
                        </div>

                        {/* Glassmorphic Tile 2: (lg:col-span-5) Hardware Intent Switch */}
                        <div className="lg:col-span-5 p-7 sm:p-8 bg-white/[0.07] backdrop-blur-2xl border border-white/25 ring-1 ring-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] hover:border-white/40 hover:bg-white/[0.10] transition-all flex flex-col justify-between group">
                            <div>
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                                        <Cpu size={22} />
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] uppercase font-semibold">
                                        secp256k1 CORE
                                    </span>
                                </div>

                                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold block mb-1 drop-shadow-sm">
                                    PHYSICAL CONFIRMATION
                                </span>
                                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 font-sans drop-shadow-sm">
                                    Hardware Intent Switch
                                </h3>
                                <p className="text-sm text-white/85 leading-relaxed mb-6 font-sans">
                                    Offline ESP32-S3 microcontroller isolates cryptographic operations. A physical GPIO interrupt switch requires tactile button confirmation before signature generation can be triggered.
                                </p>
                            </div>

                            {/* Visual Tactile Switch Diagram in Dark Glass */}
                            <div className="p-4 rounded-xl bg-black/30 backdrop-blur-md border border-white/15 space-y-3 font-mono text-xs shadow-inner">
                                <div className="flex items-center justify-between text-white">
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                        <span className="font-semibold">GPIO 18 [CONFIRM]</span>
                                    </span>
                                    <span className="text-emerald-400 font-bold">ACTIVE INTERLOCK</span>
                                </div>
                                <div className="flex items-center justify-between text-white/60">
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-rose-400/80 shadow-[0_0_6px_rgba(251,113,133,0.5)]" />
                                        <span>GPIO 19 [ABORT]</span>
                                    </span>
                                    <span>BUFFER PURGE</span>
                                </div>
                                <div className="p-2.5 rounded bg-white/[0.06] border border-white/10 text-[11px] text-white/80 leading-snug">
                                    ➔ Silicon cannot sign without physical button debounce pulse. Zero remote authorization exploits.
                                </div>
                            </div>

                            <div className="mt-5 pt-4 border-t border-white/15 flex items-center justify-between text-xs font-mono text-white/70">
                                <span>Boundary: Fail-Closed</span>
                                <span className="text-emerald-400 font-semibold">Physical Interrupt Latch</span>
                            </div>
                        </div>

                        {/* Glassmorphic Tile 3: (lg:col-span-4) Tamper-Proof Clear-Signing OLED */}
                        <div className="lg:col-span-4 p-6 sm:p-7 bg-white/[0.07] backdrop-blur-2xl border border-white/25 ring-1 ring-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] hover:border-white/40 hover:bg-white/[0.10] transition-all flex flex-col justify-between group">
                            <div>
                                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform shadow-inner">
                                    <Terminal size={20} />
                                </div>
                                <span className="text-xs font-mono text-white/60 uppercase tracking-wider font-semibold block mb-1">
                                    SILICON SCREEN
                                </span>
                                <h3 className="text-lg font-bold text-white mb-2 font-sans drop-shadow-sm">
                                    Clear-Signing OLED
                                </h3>
                                <p className="text-xs sm:text-sm text-white/80 leading-relaxed mb-5 font-sans">
                                    0.96" Monochrome SSD1306 display renders human-verified payment data directly from RAM. Rejects multi-page truncation or hidden calldata.
                                </p>
                            </div>

                            {/* OLED Mini Chassis */}
                            <div className="p-3.5 rounded-lg bg-black/60 border border-neutral-700/80 font-mono text-[11px] text-emerald-400 shadow-inner space-y-1">
                                <div className="text-[10px] text-neutral-400 flex items-center justify-between pb-1 border-b border-neutral-800">
                                    <span>MELODYPAY POS</span>
                                    <span>I2C 128x64</span>
                                </div>
                                <div className="pt-1 text-white font-bold">PAY: 1.00</div>
                                <div className="text-emerald-400/90 text-[10px]">TO: 0x0E69...7BCF</div>
                                <div className="text-emerald-400 text-[10px] flex items-center gap-1.5 pt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>PRESS CONFIRM BUTTON</span>
                                </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-white/15 text-[11px] font-mono text-white/60 flex items-center justify-between">
                                <span>What You See Is What You Sign</span>
                            </div>
                        </div>

                        {/* Glassmorphic Tile 4: (lg:col-span-4) Noise Resilience (FEC) */}
                        <div className="lg:col-span-4 p-6 sm:p-7 bg-white/[0.07] backdrop-blur-2xl border border-white/25 ring-1 ring-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] hover:border-white/40 hover:bg-white/[0.10] transition-all flex flex-col justify-between group">
                            <div>
                                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-300 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform shadow-inner">
                                    <Waves size={20} />
                                </div>
                                <span className="text-xs font-mono text-amber-300 uppercase tracking-wider font-semibold block mb-1">
                                    ERROR CORRECTION
                                </span>
                                <h3 className="text-lg font-bold text-white mb-2 font-sans drop-shadow-sm">
                                    Noise-Resilient Demodulation
                                </h3>
                                <p className="text-xs sm:text-sm text-white/80 leading-relaxed mb-5 font-sans">
                                    Frequency-Shift Keying paired with Reed-Solomon Forward Error Correction reconstructs missing or clipped audio packets through busy restaurant chatter and ambient music.
                                </p>
                            </div>

                            {/* Signal-to-Noise Ratio Meter */}
                            <div className="p-3.5 rounded-lg bg-black/30 backdrop-blur-md border border-white/15 font-mono text-[11px] space-y-2 shadow-inner">
                                <div className="flex items-center justify-between text-white">
                                    <span>ACOUSTIC SNR:</span>
                                    <span className="text-emerald-400 font-bold">+18.4 dB [OPTIMAL]</span>
                                </div>
                                <div className="flex gap-1 h-2">
                                    {[...Array(12)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={`flex-1 rounded-sm ${
                                                i < 10 ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" : "bg-white/20"
                                            }`}
                                        />
                                    ))}
                                </div>
                                <div className="text-[10px] text-white/60 flex items-center justify-between pt-1">
                                    <span>FEC Recovery</span>
                                    <span className="text-emerald-400 font-semibold">100% (32/32 Chunks)</span>
                                </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-white/15 text-[11px] font-mono text-white/60 flex items-center justify-between">
                                <span>Robust Against Ambient Din</span>
                            </div>
                        </div>

                        {/* Glassmorphic Tile 5: (lg:col-span-4) Instant Settlement */}
                        <div className="lg:col-span-4 p-6 sm:p-7 bg-white/[0.07] backdrop-blur-2xl border border-white/25 ring-1 ring-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] hover:border-white/40 hover:bg-white/[0.10] transition-all flex flex-col justify-between group">
                            <div>
                                <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/20 border border-[#38BDF8]/30 text-[#38BDF8] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform shadow-inner">
                                    <Zap size={20} />
                                </div>
                                <span className="text-xs font-mono text-[#38BDF8] uppercase tracking-wider font-semibold block mb-1">
                                    ON-CHAIN FINALITY
                                </span>
                                <h3 className="text-lg font-bold text-white mb-2 font-sans drop-shadow-sm">
                                    Instant Settlement
                                </h3>
                                <p className="text-xs sm:text-sm text-white/80 leading-relaxed mb-5 font-sans">
                                    Non-custodial settlement with sub-second cryptographic finality. Funds transfer directly into the merchant's wallet with zero custodial middle layers.
                                </p>
                            </div>

                            {/* Settlement Telemetry Card */}
                            <div className="p-3.5 rounded-lg bg-black/30 backdrop-blur-md border border-white/15 font-mono text-[11px] space-y-1.5 shadow-inner">
                                <div className="flex items-center justify-between text-white">
                                    <span>SETTLEMENT:</span>
                                    <span className="font-bold text-[#38BDF8]">Direct &amp; Instant</span>
                                </div>
                                <div className="flex items-center justify-between text-white/60">
                                    <span>CUSTODY:</span>
                                    <span className="text-white font-semibold">Non-Custodial P2P</span>
                                </div>
                                <div className="flex items-center justify-between text-emerald-400 font-semibold pt-1 border-t border-white/10">
                                    <span>FINALITY:</span>
                                    <span>&lt; 1.0s Confirmed</span>
                                </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-white/15 text-[11px] font-mono text-white/60 flex items-center justify-between">
                                <span>Sub-Second Finality</span>
                                <span className="text-emerald-400 font-medium">Direct Execution</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* =========================================================================
                4. PROTOTYPE SNEAK PEEK SECTION: RESPONSIVE SHOWCASE & 3D MODEL
               ========================================================================= */}
            <div 
                id="prototype" 
                ref={prototypeContainerRef}
                className="relative w-full bg-[#EBF4EE] border-y border-[#D6E6DB] scroll-mt-20 lg:h-[300vh]"
            >
                {/* Pinned Sticky on desktop, Natural height and zero clipping on mobile/tablet */}
                <div className="relative lg:sticky lg:top-0 min-h-fit lg:h-screen w-full flex flex-col justify-start lg:justify-center py-10 sm:py-14 lg:py-6 pt-12 sm:pt-16 lg:pt-22 pb-10 sm:pb-14 lg:pb-6 overflow-visible lg:overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full flex flex-col justify-center">
                        {/* Section Header - Properly scaled so it never slices or collides */}
                        <div className="text-center max-w-2xl mx-auto mb-5 sm:mb-6 lg:mb-8">
                            <span className="text-xs sm:text-sm font-mono text-emerald-700 uppercase tracking-widest block mb-1.5 font-semibold">
                                // PHYSICAL ARCHITECTURE
                            </span>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#111113] font-sans">
                                Prototype Sneak Peek
                            </h2>
                            <p className="text-xs sm:text-sm text-[#4B4B52] mt-1.5 leading-relaxed font-sans">
                                Select or scroll to inspect each hardware module in our air-gapped acoustic architecture.
                            </p>
                        </div>

                        {/* Mobile Step Selector (Horizontal pills on < lg) */}
                        <div className="flex lg:hidden items-center justify-center gap-2 sm:gap-3 mb-6 select-none flex-wrap">
                            {PROTOTYPE_FEATURES.map((feat, idx) => {
                                const isActive = activeFeatureIndex === idx;
                                return (
                                    <button
                                        key={feat.id}
                                        type="button"
                                        onClick={() => scrollToStep(idx)}
                                        className={`px-3 py-1.5 rounded-full font-mono text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                                            isActive
                                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-600/30 scale-105"
                                                : "bg-white/80 text-[#555] hover:text-[#111113] hover:bg-white border border-[#D6E6DB]"
                                        }`}
                                    >
                                        <span>{feat.step}</span>
                                        <span className="text-[11px] font-sans font-medium hidden xs:inline sm:inline">
                                            {feat.partKey.toUpperCase()}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 2-COLUMN SHOWCASE: STAIRCASE FEATURES (LEFT) + 3D MODEL (RIGHT) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center w-full min-h-0">
                            {/* LEFT COLUMN: SCROLLING STAIRCASE OF FEATURES */}
                            <div className="lg:col-span-5 relative flex items-center min-h-[180px] sm:min-h-[220px] lg:h-[300px]">
                                {/* Delicate Vertical Staircase Step Rail (Desktop only) */}
                                <div className="hidden lg:flex absolute left-0 top-3 bottom-3 w-8 flex-col justify-between items-center z-10 select-none">
                                    {PROTOTYPE_FEATURES.map((feat, idx) => {
                                        const isActive = activeFeatureIndex === idx;
                                        return (
                                            <button
                                                key={feat.id}
                                                type="button"
                                                onClick={() => scrollToStep(idx)}
                                                className={`w-7 h-7 rounded-full font-mono text-xs flex items-center justify-center transition-all duration-300 cursor-pointer ${
                                                    isActive
                                                        ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30 scale-110 ring-2 ring-[#EBF4EE]"
                                                        : "text-[#7A7A85] hover:text-[#111113] hover:bg-white/60"
                                                }`}
                                            >
                                                {feat.step}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Thin rail line behind step numbers (Desktop only) */}
                                <div className="hidden lg:block absolute left-[15px] top-4 bottom-4 w-[2px] bg-[#D2E2D8] -z-0" />

                                {/* Staircase Feature Viewport Window */}
                                <div className="w-full h-full relative pl-0 lg:pl-14 flex items-center overflow-hidden">
                                    <AnimatePresence mode="wait" custom={direction}>
                                        <motion.div
                                            key={currentFeature.id}
                                            custom={direction}
                                            variants={{
                                                enter: (dir: number) => ({
                                                    y: dir > 0 ? 30 : -30,
                                                    opacity: 0,
                                                    filter: "blur(2px)"
                                                }),
                                                center: {
                                                    y: 0,
                                                    opacity: 1,
                                                    filter: "blur(0px)",
                                                    transition: {
                                                        y: { type: "spring", stiffness: 320, damping: 28 },
                                                        opacity: { duration: 0.25 },
                                                        filter: { duration: 0.18 }
                                                    }
                                                },
                                                exit: (dir: number) => ({
                                                    y: dir > 0 ? -30 : 30,
                                                    opacity: 0,
                                                    filter: "blur(2px)",
                                                    transition: {
                                                        y: { type: "spring", stiffness: 320, damping: 28 },
                                                        opacity: { duration: 0.2 },
                                                        filter: { duration: 0.15 }
                                                    }
                                                })
                                            }}
                                            initial="enter"
                                            animate="center"
                                            exit="exit"
                                            className="w-full flex flex-col justify-center text-center lg:text-left"
                                        >
                                            <span className="text-xs sm:text-sm font-mono font-bold text-emerald-700 uppercase tracking-widest block mb-1.5">
                                                {currentFeature.step} &mdash; {currentFeature.tag}
                                            </span>

                                            <h3 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-extrabold text-[#111113] font-sans tracking-tight mb-1.5">
                                                {currentFeature.title}
                                            </h3>

                                            <div className="text-xs sm:text-sm text-[#4B4B52] font-mono mb-3">
                                                {currentFeature.subtitle}
                                            </div>

                                            <p className="text-sm sm:text-base text-[#333338] leading-relaxed font-sans max-w-lg mx-auto lg:mx-0">
                                                {currentFeature.desc}
                                            </p>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: 3D HARDWARE MODEL */}
                            <div className="lg:col-span-7 h-[260px] sm:h-[320px] lg:h-[380px] xl:h-[420px] flex items-center justify-center relative pointer-events-auto">
                                <div className="w-full h-full relative flex items-center justify-center select-none">
                                    <Hardware3DScene
                                        activePartKey={currentFeature.partKey}
                                        explosionProgress={0}
                                        isHeroRotating={true}
                                        onPartSelect={handle3DPartSelect}
                                        className="w-full h-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                5. FAQS SECTION: INTERACTIVE ACCORDION
               ========================================================================= */}
            <section id="faqs" className="relative w-full max-w-5xl mx-auto px-4 lg:px-8 py-20 z-10 border-t border-[#E2E2DA] scroll-mt-20">
                <div className="mb-14 text-center max-w-2xl mx-auto">
                    <span className="text-xs font-mono text-[#0088FF] uppercase tracking-wider block mb-2 font-semibold">
                        // CLARIFICATIONS & PROTOCOL INTEGRITY
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111113] font-sans">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-sm text-[#4B4B52] mt-3 leading-relaxed font-sans">
                        Everything you need to know about air-gapped acoustic cryptography and gasless smart contracts.
                    </p>
                </div>

                <div className="space-y-4">
                    {FAQS.map((faq, idx) => {
                        const isOpen = openFaq === idx;
                        return (
                            <div 
                                key={idx}
                                className="bg-white rounded-xl border border-[#E2E2DA] overflow-hidden transition-all shadow-sm"
                            >
                                <button
                                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                                    className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-neutral-50/70 transition-colors"
                                >
                                    <span className="text-base font-semibold text-[#111113] font-sans">
                                        {faq.q}
                                    </span>
                                    <ChevronDown 
                                        size={18} 
                                        className={`text-neutral-400 shrink-0 transition-transform duration-200 ${
                                            isOpen ? "rotate-180 text-[#111113]" : ""
                                        }`}
                                    />
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-6 pb-6 pt-1 text-sm text-[#4B4B52] leading-relaxed border-t border-neutral-100 font-sans">
                                                {faq.a}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* =========================================================================
                6. ARCHITECTURAL FOOTER: PROTOCOL RIBBON, MULTI-COLUMN MATRIX & TELEMETRY
               ========================================================================= */}
            <footer className="relative w-full bg-[#0d281a] text-white border-t border-neutral-800 pt-16 pb-12 overflow-hidden">
                {/* Hero Panorama Background: visible, lush, and recognizable, faded with soft dark wash */}
                <img
                    src="/image copy 3.png"
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-70 pointer-events-none select-none z-0"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-[#111113]/90 pointer-events-none z-0" />

                {/* 5-Line Musical Stave Cursive 'melodypay' Ribbon Wave */}
                <div className="relative z-10 w-full max-w-6xl mx-auto px-4 h-48 sm:h-56 mb-10">
                    <MelodyPayStaffRibbon />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8">
                    {/* Main Footer Row */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-neutral-800/80 items-start">
                        {/* Brand Column */}
                        <div className="md:col-span-6 flex flex-col items-start">
                            <div className="flex items-center gap-2.5 mb-3">
                                <MelodyLogoM size={22} />
                                <span className="text-base font-bold tracking-tight text-white font-sans">
                                    MelodyPay
                                </span>
                            </div>
                            <p className="text-xs text-neutral-400 font-sans leading-relaxed max-w-sm">
                                The air-gapped acoustic payment standard. Offline hardware signs transactions with physical button confirmation, settled instantly on-chain.
                            </p>
                        </div>

                        {/* Col 1: Product */}
                        <div className="md:col-span-3">
                            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block mb-3 font-semibold">
                                Product
                            </span>
                            <ul className="space-y-2 text-xs text-neutral-300 font-sans">
                                <li><Link to="/receive" className="hover:text-white transition-colors">Receive Payments</Link></li>
                                <li><Link to="/register" className="hover:text-white transition-colors">Pre-book HardWallet</Link></li>
                                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                                <li><a href="#prototype" className="hover:text-white transition-colors">Hardware Prototype</a></li>
                                <li><a href="#faqs" className="hover:text-white transition-colors">FAQs</a></li>
                            </ul>
                        </div>

                        {/* Col 2: Developers */}
                        <div className="md:col-span-3">
                            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block mb-3 font-semibold">
                                Developers & Code
                            </span>
                            <ul className="space-y-2 text-xs text-neutral-300 font-sans">
                                <li>
                                    <a 
                                        href="https://github.com/tyraakj/melodypay" 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="hover:text-white transition-colors flex items-center gap-1.5"
                                    >
                                        <span>GitHub Repository</span>
                                        <ExternalLink size={12} />
                                    </a>
                                </li>
                                <li>
                                    <a 
                                        href="https://github.com/tyraakj/melodypay/tree/feat/ui-ux/cli" 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="hover:text-white transition-colors flex items-center gap-1.5"
                                    >
                                        <span>Receiver CLI Package</span>
                                        <ExternalLink size={12} />
                                    </a>
                                </li>
                                <li>
                                    <a 
                                        href="https://github.com/tyraakj/melodypay/tree/feat/ui-ux/contracts" 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="hover:text-white transition-colors flex items-center gap-1.5"
                                    >
                                        <span>Smart Contracts</span>
                                        <ExternalLink size={12} />
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Bottom Status & Copyright */}
                    <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-500">
                        <div>
                            © 2026 MelodyPay Protocol. MIT Open Source.
                        </div>
                        <div>
                            <a href="#top" className="hover:text-white transition-colors">Back to top ↑</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
