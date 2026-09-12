import { useState, useEffect, useRef } from "react";
import { Cpu, Mic, Volume2, ShieldCheck, Check, Layers, Radio, Sparkles, Eye, Sliders } from "lucide-react";
import { Hardware3DScene } from "./3d/Hardware3DScene";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ComponentSpec {
    id: string;
    name: string;
    role: string;
    pinout: string;
    details: string;
    securityRule: string;
    icon: typeof Cpu;
    accentColor: string;
}

const HARDWARE_SPECS: Record<string, ComponentSpec> = {
    mcu: {
        id: "mcu",
        name: "ESP32-S3 Dual-Core LX7",
        role: "Air-Gapped Cryptographic Core",
        pinout: "240 MHz Xtensa LX7 // 512KB SRAM // 8MB Flash // USB-C OTG",
        details: "Runs custom ESP-IDF firmware. Verifies CRC-8 chunk framing, enforces strict chain whitelisting (Arc 5042002, Monad 10143, Sepolia 11155111), and computes EIP-712 digests.",
        securityRule: "Fail-closed signing interface. Zero network connectivity (no WiFi, no BLE enabled). Never signs without physical button actuation.",
        icon: Cpu,
        accentColor: "#836EF9"
    },
    mic: {
        id: "mic",
        name: "INMP441 I2S Microphone",
        role: "Acoustic Invoice Capture (Input)",
        pinout: "SCK: GPIO 4 // WS: GPIO 5 // SD: GPIO 6 // VDD: 3.3V",
        details: "High-precision omnidirectional digital MEMS microphone with I2S DMA streaming directly into the ggwave FSK audio decoder at 48 kHz.",
        securityRule: "Audio input buffer is hardware-muted during speaker transmission to prevent the device from decoding its own acoustic echoes.",
        icon: Mic,
        accentColor: "#A855F7"
    },
    oled: {
        id: "oled",
        name: "0.96\" Cyan OLED (SSD1306)",
        role: "Clear-Screen Human Verification",
        pinout: "I2C SDA: GPIO 8 // SCL: GPIO 9 // Resolution: 128x64",
        details: "High-contrast graphical display rendering complete, un-truncated recipient addresses, token amounts, chain IDs, and gas ceilings before approval.",
        securityRule: "Strictly forbids multi-page truncation or hidden calldata. If the address doesn't fit on the review screen, the transaction is rejected.",
        icon: Eye,
        accentColor: "#00E5FF"
    },
    buttons: {
        id: "buttons",
        name: "Tactile Approval Pushbuttons",
        role: "Physical User Approval Boundary",
        pinout: "Approve: GPIO 21 (Hold 2s) // Reject: GPIO 22 (Instant)",
        details: "Two tactile mechanical switches wired with hardware debouncing. The user must physically review the recipient and amount on the OLED before pressing Approve.",
        securityRule: "The physical button press is the inviolable signing boundary. Audio transport carries data, but only human physical actuation authorizes cryptographic signing.",
        icon: ShieldCheck,
        accentColor: "#10B981"
    },
    amp: {
        id: "amp",
        name: "Piezo Acoustic Transducer",
        role: "Acoustic Signature Transmitter (Output)",
        pinout: "BCLK: GPIO 15 // LRCLK: GPIO 16 // DIN: GPIO 7 // Gain: 12dB",
        details: "Direct digital I2S synthesis converting raw PCM audio into analog sound waves (1875 Hz – 2187 Hz) carrying EIP-3009 cryptographic signatures over air.",
        securityRule: "Emits bounded chunks (max 128 bytes per burst) with 300ms inter-burst silence for clean receiver synchronization.",
        icon: Volume2,
        accentColor: "#F59E0B"
    },
    bus: {
        id: "bus",
        name: "Solderless Jumper Bus & Rails",
        role: "Physical Signal Routing Layer",
        pinout: "Dual Power Rails (+/- 3.3V) // 60 Tie-Point Terminal Strips",
        details: "Point-to-point isolated breadboard connections routing I2S audio clocks, I2C display buses, and debounced hardware interrupt lines.",
        securityRule: "Zero shared data traces with external connectors. Only clean 3.3V DC power is accepted from external USB-C power banks.",
        icon: Layers,
        accentColor: "#3B82F6"
    }
};

export function HardwareTeardown() {
    const [selectedKey, setSelectedKey] = useState<string>("mcu");
    const [explosionProgress, setExplosionProgress] = useState<number>(0.85);
    const [isAutoScroll, setIsAutoScroll] = useState<boolean>(true);
    const teardownRef = useRef<HTMLDivElement | null>(null);
    const active = HARDWARE_SPECS[selectedKey] || HARDWARE_SPECS.mcu;

    // Map 3D mesh click part names to spec keys
    const handle3DPartSelect = (partName: string) => {
        if (partName.includes("esp32")) setSelectedKey("mcu");
        else if (partName.includes("mic") || partName.includes("inmp")) setSelectedKey("mic");
        else if (partName.includes("oled")) setSelectedKey("oled");
        else if (partName.includes("button")) setSelectedKey("buttons");
        else if (partName.includes("speaker")) setSelectedKey("amp");
        else if (partName.includes("breadboard") || partName.includes("wire")) setSelectedKey("bus");
    };

    // GSAP ScrollTrigger to automatically separate components as user scrolls through the section
    useEffect(() => {
        const el = teardownRef.current;
        if (!el || !isAutoScroll) return;

        const trigger = ScrollTrigger.create({
            trigger: el,
            start: "top 80%",
            end: "bottom 30%",
            scrub: 1,
            onUpdate: (self) => {
                // Progress moves from 0 (assembled) to 1 (fully exploded)
                const p = Math.min(Math.max(self.progress * 1.15, 0), 1);
                setExplosionProgress(p);
            }
        });

        return () => {
            trigger.kill();
        };
    }, [isAutoScroll]);

    return (
        <div ref={teardownRef} className="w-full bg-[#FFFFFF] border border-[#E2E2DA] rounded-2xl p-6 sm:p-8 shadow-sm text-[#111113] font-sans overflow-hidden">
            {/* Header & Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E2E2DA]">
                <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-[#836EF9]/10 border border-[#836EF9]/20 text-[#836EF9]">
                        <Cpu size={18} />
                    </span>
                    <div>
                        <h3 className="text-base font-bold text-[#111113] font-sans tracking-tight flex items-center gap-2">
                            <span>Interactive 3D Hardware Teardown</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#836EF9]/10 text-[#836EF9] border border-[#836EF9]/30 text-[10px] font-mono font-semibold">
                                EXPLODED VIEW
                            </span>
                        </h3>
                        <p className="text-xs text-[#7A7A85] font-mono">
                            PHYSICAL ESP32-S3 SOUND WALLET // ZERO-INTERNET SILICON BOUNDARY
                        </p>
                    </div>
                </div>

                {/* Exploded View Slider & Mode Controls */}
                <div className="flex items-center gap-3 bg-[#F5F5F0] border border-[#E2E2DA] rounded-md px-4 py-1.5 shadow-inner">
                    <Sliders size={13} className="text-[#7A7A85]" />
                    <span className="text-[11px] font-mono text-[#4B4B52]">Explode:</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={explosionProgress}
                        onChange={(e) => {
                            setIsAutoScroll(false);
                            setExplosionProgress(parseFloat(e.target.value));
                        }}
                        className="w-24 sm:w-32 h-1.5 bg-[#E2E2DA] rounded-lg appearance-none cursor-pointer accent-[#836EF9]"
                        aria-label="Explosion Progress Slider"
                    />
                    <span className="text-[11px] font-mono text-[#836EF9] font-semibold w-10">
                        {Math.round(explosionProgress * 100)}%
                    </span>
                </div>
            </div>

            {/* Main Interactive 3D Teardown Stage */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-center">
                {/* 3D Viewport Column (Interactive Exploded Hardware) */}
                <div className="lg:col-span-7 h-[360px] sm:h-[460px] md:h-[500px] rounded-xl bg-gradient-to-b from-[#FBFBF9] via-[#F5F5F0] to-[#EFEFEA] border border-[#E2E2DA] relative overflow-hidden flex items-center justify-center group shadow-inner">
                    <Hardware3DScene
                        explosionProgress={explosionProgress}
                        isHeroRotating={explosionProgress < 0.15}
                        onPartSelect={handle3DPartSelect}
                        className="w-full h-full"
                    />

                    {/* Interactive Overlay Hints */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/80 backdrop-blur-md border border-[#E2E2DA] text-[10px] font-mono text-[#4B4B52] shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-xs bg-[#0088FF] animate-pulse" />
                            CLICK 3D PARTS TO INSPECT
                        </span>
                    </div>

                    <div className="absolute bottom-3 right-3 pointer-events-none hidden sm:block">
                        <span className="px-2.5 py-1 rounded-md bg-white/80 backdrop-blur-md border border-[#E2E2DA] text-[10px] font-mono text-[#7A7A85] shadow-sm">
                            DRAG TO ORBIT // SCROLL TO EXPAND
                        </span>
                    </div>
                </div>

                {/* Selected Component Inspection Telemetry Column */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    {/* Component Navigation Chips */}
                    <div className="grid grid-cols-3 gap-2">
                        {Object.values(HARDWARE_SPECS).map((spec) => {
                            const IconComponent = spec.icon;
                            const isSelected = selectedKey === spec.id;
                            return (
                                <button
                                    key={spec.id}
                                    type="button"
                                    onClick={() => setSelectedKey(spec.id)}
                                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                                        isSelected
                                            ? "bg-white border-[#836EF9] shadow-sm text-[#111113]"
                                            : "bg-[#F5F5F0] border-[#E2E2DA] hover:bg-white text-[#4B4B52]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <IconComponent size={14} style={{ color: isSelected ? spec.accentColor : "#7A7A85" }} />
                                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#836EF9]" />}
                                    </div>
                                    <span className={`text-[11px] font-mono font-medium truncate ${isSelected ? "text-[#111113] font-semibold" : "text-[#4B4B52]"}`}>
                                        {spec.name.split(" ")[0]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Active Component Spec Card */}
                    <div className="p-5 rounded-xl bg-[#FBFBF9] border border-[#E2E2DA] flex flex-col justify-between relative overflow-hidden shadow-sm">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span 
                                    className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider"
                                    style={{ backgroundColor: `${active.accentColor}18`, color: active.accentColor }}
                                >
                                    {active.role}
                                </span>
                                <span className="text-[10px] font-mono text-[#7A7A85]">STATUS: VERIFIED SILICON</span>
                            </div>

                            <h4 className="text-lg font-bold text-[#111113] font-sans mb-1">
                                {active.name}
                            </h4>

                            <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E2DA] font-mono text-[11px] text-[#0088FF] mb-3">
                                {active.pinout}
                            </div>

                            <p className="text-xs text-[#4B4B52] leading-relaxed mb-4 font-sans">
                                {active.details}
                            </p>
                        </div>

                        {/* Security Invariant Callout */}
                        <div className="pt-3 border-t border-[#E2E2DA] flex items-start gap-2 text-xs font-mono text-emerald-800 bg-emerald-50/80 p-2.5 rounded border border-emerald-200">
                            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                            <span className="leading-snug text-[11px]">
                                <strong className="text-emerald-900">SECURITY RULE:</strong> {active.securityRule}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Hardware Guarantees Strip */}
            <div className="pt-4 border-t border-[#E2E2DA] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono text-[#4B4B52]">
                <div className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600" />
                    <span>No WiFi / Bluetooth / Cellular Radios</span>
                </div>
                <div className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600" />
                    <span>DMA FSK Demodulation at 48.0 kHz</span>
                </div>
                <div className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600" />
                    <span>EIP-712 Structured Keccak-256 Hashing</span>
                </div>
            </div>
        </div>
    );
}
