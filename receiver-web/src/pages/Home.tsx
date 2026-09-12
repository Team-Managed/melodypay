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
    Globe,
    Terminal as TerminalIcon,
    Layers,
    ChevronDown,
    Lock,
    Activity,
    Sparkles,
    ChevronRight,
    ChevronLeft
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
        repo: "esp32/components/eip3009",
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
        desc: "SSD1306 display showing real-time acoustic telemetry and human-verified transaction data: exact USDC amount, verified merchant ENS subname (*.melodypay.eth), and nonce.",
        bus: "I2C SDA: GPIO 21 // SCL: GPIO 22 // 128x64 px",
        security: "Strictly forbids multi-page truncation or hidden calldata; rejects signing if address does not fit.",
        repo: "esp32/components/oled",
        partKey: "oled"
    },
];

const FAQS = [
    {
        q: "Can someone in the room eavesdrop or replay the acoustic sound wave to steal funds?",
        a: "No. Every acoustic payment carries a cryptographically unique EIP-3009 nonce, a 60-second expiration window (validBefore), and the merchant's specific recipient address. Once the settlement smart contract executes the authorization on Arc or Monad, that nonce is permanently invalidated on-chain. Any recorded or repeated playback is rejected by the smart contract as an invalid duplicate nonce."
    },
    {
        q: "Does the customer need ETH or native gas tokens to pay?",
        a: "Never. The customer only needs the USDC they are spending. They need $0.00 of native gas tokens. MelodyPay uses EIP-3009 receiveWithAuthorization, meaning the merchant's POS terminal acts as a gas relayer and pays the minor transaction fee on Arc Network or Monad to settle the payment."
    },
    {
        q: "What happens in loud environments like noisy restaurants, bars, or bustling streets?",
        a: "MelodyPay utilizes ggwave's Frequency-Shift Keying (FSK) modulation paired with Reed-Solomon Forward Error Correction (FEC). The protocol isolates narrow carrier frequencies between 1875 Hz and 2187 Hz and can reconstruct missing or clipped audio packets even through background chatter, dish clatter, and ambient music."
    },
    {
        q: "Why use acoustic sound waves instead of NFC or QR codes?",
        a: "NFC requires specialized reader chips, close physical proximity (< 4 cm), and is vulnerable to relay attacks. QR codes require line-of-sight camera alignment, proper lighting, and clean lenses. Sound waves propagate omnidirectionally through the air, require zero physical contact or optical alignment, and function on any standard smartphone or laptop microphone."
    },
    {
        q: "Which blockchains and tokens are supported today?",
        a: "MelodyPay natively supports Arc Network (utilizing the canonical native USDC precompile at 0x3600000000000000000000000000000000000000), Sepolia for ENSv2 merchant subname registration (*.melodypay.eth) via ENS NameWrapper, Monad Testnet for high-speed 10,000 TPS acoustic transfers, and Ethereum Mainnet."
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
        if (!prototypeContainerRef.current) return;
        const rect = prototypeContainerRef.current.getBoundingClientRect();
        const scrollTop = window.scrollY + rect.top;
        const scrollDistance = prototypeContainerRef.current.offsetHeight - window.innerHeight;
        const targetProgress = (targetIndex / 4) * 0.96;
        const targetScrollY = scrollTop + (targetProgress * scrollDistance);

        setDirection(targetIndex > activeIndexRef.current ? 1 : -1);
        setActiveFeatureIndex(targetIndex);
        window.scrollTo({ top: targetScrollY, behavior: "smooth" });
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
                                "MENU-DRIVEN CLI DASHBOARD",
                                "USB SERIAL REPL PROTOCOL",
                                "FAIL-CLOSED HARDWARE ENCLAVE",
                                "MULTICHAIN EVM SETTLEMENT",
                                "ENSV2 MERCHANT REGISTRAR",
                                "ESP32-S3 PHYSICAL SIGNER",
                                "INMP441 I2S INVOICE CAPTURE",
                                "GGWAVE NATIVE ACOUSTIC MODEM",
                                "GASLESS EIP-3009 TRANSFERS",
                                "KEYLESS UNTRUSTED RECEIVER",
                                "OLED & I2S BENCH DIAGNOSTICS"
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

            {/* =========================================================================
                2. FEATURES SECTION: ARCHITECTURAL MATRIX (6 CORE PILLARS)
               ========================================================================= */}
            <section id="features" className="relative w-full max-w-7xl mx-auto px-4 lg:px-8 py-20 z-10 scroll-mt-20">
                <div className="mb-14 text-center max-w-2xl mx-auto">
                    <span className="text-xs font-mono text-[#0088FF] uppercase tracking-wider block mb-2 font-semibold">
                        // PROTOCOL CAPABILITIES
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111113] font-sans">
                        Engineered for Sovereign Money
                    </h2>
                    <p className="text-sm text-[#4B4B52] mt-3 leading-relaxed font-sans">
                        MelodyPay combines zero-RF physical hardware, air-gapped acoustic modems, and gasless smart contracts into a frictionless payment standard.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Feature 1: Acoustic Air-Gap */}
                    <div className="p-6 bg-white rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all group">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-[#0088FF]/10 text-[#0088FF] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                <Radio size={20} />
                            </div>
                            <span className="px-2 py-0.5 rounded bg-neutral-100 text-[#111113] font-mono text-[10px] uppercase font-semibold">
                                ZERO RF EMISSIONS
                            </span>
                            <h3 className="text-lg font-bold text-[#111113] mt-3 mb-2 font-sans">
                                Acoustic Air-Gap Wire
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                No Bluetooth, Wi-Fi, NFC, or radio chips. Encrypted EIP-3009 payment payloads travel strictly through audible or ultrasonic sound waves via ggwave FSK modulation.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-[#0088FF] flex items-center justify-between">
                            <span>0.00 mW RF Radiation</span>
                            <span>1875 – 2187 Hz</span>
                        </div>
                    </div>

                    {/* Feature 2: Gasless EIP-3009 */}
                    <div className="p-6 bg-white rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all group">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                <Zap size={20} />
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] uppercase font-semibold">
                                ZERO GAS FEES FOR PAYER
                            </span>
                            <h3 className="text-lg font-bold text-[#111113] mt-3 mb-2 font-sans">
                                Gasless EIP-3009 USDC
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                Customers pay with pure USDC. Zero native gas tokens (ETH/ARC) needed. The merchant's terminal relays the transaction and pays the negligible network gas.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-emerald-600 flex items-center justify-between">
                            <span>Customer Gas: $0.00</span>
                            <span>EIP-712 Typed Data</span>
                        </div>
                    </div>

                    {/* Feature 3: Hardware Enclave */}
                    <div className="p-6 bg-white rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all group">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-[#836EF9]/10 text-[#836EF9] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                <Cpu size={20} />
                            </div>
                            <span className="px-2 py-0.5 rounded bg-[#836EF9]/10 text-[#836EF9] font-mono text-[10px] uppercase font-semibold">
                                PHYSICAL CONFIRMATION
                            </span>
                            <h3 className="text-lg font-bold text-[#111113] mt-3 mb-2 font-sans">
                                Hardware Intent Switch
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                Offline ESP32-S3 microcontroller requires a physical tactile button press to authorize signatures. Private keys never leave the silicon and cannot be queried remotely.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-[#836EF9] flex items-center justify-between">
                            <span>secp256k1 Core</span>
                            <span>Hardware Interlock</span>
                        </div>
                    </div>

                    {/* Feature 4: ENSv2 Merchant Subnames */}
                    <div className="p-6 bg-white rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all group">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-neutral-100 text-[#111113] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                <Globe size={20} />
                            </div>
                            <span className="px-2 py-0.5 rounded bg-neutral-100 text-[#111113] font-mono text-[10px] uppercase font-semibold">
                                DECENTRALIZED IDENTITY
                            </span>
                            <h3 className="text-lg font-bold text-[#111113] mt-3 mb-2 font-sans">
                                ENSv2 Subname Registrar
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                Instant merchant registration under <code className="font-mono bg-[#F5F5F0] px-1 py-0.5 rounded text-[11px]">melodypay.eth</code> with ENS NameWrapper ERC-1155 tokens, forward address resolution, and Arc routing text records.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-[#111113] flex items-center justify-between">
                            <span>Emancipated Subnames</span>
                            <span>Sepolia NameWrapper</span>
                        </div>
                    </div>

                    {/* Feature 5: Menu-Driven CLI Dashboard & USB Device Manager */}
                    <div className="p-6 bg-white rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all group">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                <TerminalIcon size={20} />
                            </div>
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono text-[10px] uppercase font-semibold">
                                MENU-DRIVEN CLI & USB CONTROL
                            </span>
                            <h3 className="text-lg font-bold text-[#111113] mt-3 mb-2 font-sans">
                                CLI Dashboard & USB Manager
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                Interactive Node.js terminal powered by <code className="font-mono bg-[#F5F5F0] px-1 py-0.5 rounded text-[11px]">@clack/prompts</code> and <code className="font-mono bg-[#F5F5F0] px-1 py-0.5 rounded text-[11px]">serialport</code>. Auto-detects ESP32-S3 over USB serial (115200 baud), runs hardware self-tests, configures active chains in NVS, and operates a keyless store POS.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-amber-600 flex items-center justify-between">
                            <span>USB Serial 115200</span>
                            <span>Port Lifecycle</span>
                        </div>
                    </div>

                    {/* Feature 6: Structured ESP32 REPL Control Protocol */}
                    <div className="p-6 bg-white rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between hover:border-[#111113]/30 hover:shadow-md transition-all group">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                <Layers size={20} />
                            </div>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] uppercase font-semibold">
                                STRUCTURED JSON PROTOCOL
                            </span>
                            <h3 className="text-lg font-bold text-[#111113] mt-3 mb-2 font-sans">
                                Line-Oriented REPL Boundary
                            </h3>
                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4">
                                Secure <code className="font-mono bg-[#F5F5F0] px-1 py-0.5 rounded text-[11px]">api &lt;json&gt;</code> control boundary on ESP32-S3 firmware. Emits structured JSON responses with request IDs, runs OLED & audio self-tests, and enforces fail-closed capability-reported signing with zero key export.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-blue-600 flex items-center justify-between">
                            <span>Fail-Closed Enclave</span>
                            <span>ggwave_transport.cpp</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* =========================================================================
                3. HOW IT WORKS SECTION: 5-STEP PROTOCOL FLOW
               ========================================================================= */}
            <section id="how-it-works" className="relative w-full max-w-7xl mx-auto px-4 lg:px-8 py-20 z-10 border-t border-[#E2E2DA] scroll-mt-20">
                <div className="mb-14 text-center max-w-2xl mx-auto">
                    <span className="text-xs font-mono text-[#0088FF] uppercase tracking-wider block mb-2 font-semibold">
                        // ARCHITECTURAL FLOW
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111113] font-sans">
                        How It Works
                    </h2>
                    <p className="text-sm text-[#4B4B52] mt-3 leading-relaxed font-sans">
                        From acoustic invoice broadcast to on-chain finality in 5 deterministic steps.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
                    {[
                        {
                            step: "01",
                            role: "POS TERMINAL",
                            title: "Invoice Emission",
                            desc: "Store register generates EIP-3009 request (amount, merchant ENS, nonce) and emits an acoustic chime into the room.",
                            badge: "Audio Out"
                        },
                        {
                            step: "02",
                            role: "ESP32-S3 HARDWARE",
                            title: "Air-Gap Capture",
                            desc: "Offline wallet listens through INMP441 I2S microphone, demodulating the audio payload into RAM completely air-gapped.",
                            badge: "Audio In"
                        },
                        {
                            step: "03",
                            role: "HUMAN USER",
                            title: "Tactile Review",
                            desc: "OLED displays merchant identity and exact USDC amount. Customer presses physical button to confirm intent.",
                            badge: "Physical Interlock"
                        },
                        {
                            step: "04",
                            role: "ESP32-S3 HARDWARE",
                            title: "Signature Chirp",
                            desc: "Silicon signs with secp256k1 private key and broadcasts an acoustic signature burst back through its internal speaker.",
                            badge: "Audio Out"
                        },
                        {
                            step: "05",
                            role: "SMART CONTRACT",
                            title: "Instant Settle",
                            desc: "POS terminal captures audio signature and calls receiveWithAuthorization on Arc or Monad. Gas covered by merchant.",
                            badge: "On-Chain Receipt"
                        }
                    ].map((item, idx) => (
                        <div 
                            key={idx}
                            className="bg-white p-5 rounded-xl border border-[#E2E2DA] shadow-sm flex flex-col justify-between relative hover:border-[#111113]/30 transition-all"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-2xl font-mono font-bold text-[#111113]/25">
                                        {item.step}
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-[#111113] font-semibold">
                                        {item.badge}
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-[#0088FF] uppercase tracking-wider block mb-1 font-semibold">
                                    {item.role}
                                </span>
                                <h3 className="text-base font-bold text-[#111113] mb-2 font-sans">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-[#4B4B52] leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-[#E2E2DA] text-[11px] font-mono text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                <span>Verified Phase</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* =========================================================================
                4. PROTOTYPE SNEAK PEEK SECTION: SCROLLING STAIRCASE FEATURES & STICKY 3D MODEL
               ========================================================================= */}
            {/* =========================================================================
                4. PROTOTYPE SNEAK PEEK SECTION: STICKY VIEWPORT & SCROLL-DRIVEN STAIRCASE
               ========================================================================= */}
            <div 
                id="prototype" 
                ref={prototypeContainerRef}
                className="relative w-full bg-[#EBF4EE] scroll-mt-20"
                style={{ height: "300vh" }}
            >
                {/* PINNED STICKY CONTAINER: Sticks at top: 0 until the user scrolls through all features */}
                <div className="sticky top-0 h-screen w-full flex flex-col justify-center border-y border-[#D6E6DB] overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full py-4 sm:py-6 flex flex-col justify-center">
                        {/* Section Header - Lean & Clean with single descriptive line */}
                        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8 lg:mb-10">
                            <span className="text-xs sm:text-sm font-mono text-emerald-700 uppercase tracking-widest block mb-1.5 font-semibold">
                                // PHYSICAL ARCHITECTURE
                            </span>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#111113] font-sans">
                                Prototype Sneak Peek
                            </h2>
                            <p className="text-sm sm:text-base text-[#4B4B52] mt-2 leading-relaxed font-sans">
                                Scroll to inspect each hardware module in our air-gapped acoustic architecture.
                            </p>
                        </div>

                        {/* 2-COLUMN SHOWCASE: STAIRCASE FEATURES (LEFT) + 3D MODEL (RIGHT) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center w-full min-h-0">
                            {/* LEFT COLUMN: SCROLLING STAIRCASE OF FEATURES */}
                            <div className="lg:col-span-5 relative flex items-center h-[340px] sm:h-[380px]">
                                {/* Delicate Vertical Staircase Step Rail */}
                                <div className="absolute left-0 top-3 bottom-3 w-8 flex flex-col justify-between items-center z-10 select-none">
                                    {PROTOTYPE_FEATURES.map((feat, idx) => {
                                        const isActive = activeFeatureIndex === idx;
                                        return (
                                            <button
                                                key={feat.id}
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

                                {/* Thin rail line behind step numbers */}
                                <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-[#D2E2D8] -z-0" />

                                {/* Staircase Feature Viewport Window: Current feature exits, next one enters */}
                                <div className="w-full h-full relative pl-14 flex items-center overflow-hidden">
                                    <AnimatePresence mode="wait" custom={direction}>
                                        <motion.div
                                            key={currentFeature.id}
                                            custom={direction}
                                            variants={{
                                                enter: (dir: number) => ({
                                                    y: dir > 0 ? 50 : -50,
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
                                                    y: dir > 0 ? -50 : 50,
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
                                            className="w-full flex flex-col justify-center"
                                        >
                                            <span className="text-sm font-mono font-bold text-emerald-700 uppercase tracking-widest block mb-2">
                                                {currentFeature.step} &mdash; {currentFeature.tag}
                                            </span>

                                            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111113] font-sans tracking-tight mb-2">
                                                {currentFeature.title}
                                            </h3>

                                            <div className="text-sm sm:text-base text-[#4B4B52] font-mono mb-4">
                                                {currentFeature.subtitle}
                                            </div>

                                            <p className="text-base sm:text-lg text-[#333338] leading-relaxed font-sans max-w-lg">
                                                {currentFeature.desc}
                                            </p>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: 3D HARDWARE MODEL (CLEAN & BORDERLESS) */}
                            <div className="lg:col-span-7 h-[360px] sm:h-[440px] lg:h-[480px] flex items-center justify-center relative pointer-events-auto">
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
                                <li><Link to="/receive" className="hover:text-white transition-colors">POS Terminal</Link></li>
                                <li><Link to="/register" className="hover:text-white transition-colors">Register ENS Subname</Link></li>
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
