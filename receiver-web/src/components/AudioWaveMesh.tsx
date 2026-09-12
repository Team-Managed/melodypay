import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, Radio, Sparkles } from "lucide-react";

interface AudioWaveMeshProps {
    interactive?: boolean;
    showControls?: boolean;
    className?: string;
}

export function AudioWaveMesh({ interactive = true, showControls = false, className = "" }: AudioWaveMeshProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animIdRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const burstPulseRef = useRef<{ active: boolean; x: number; speed: number; intensity: number }>({
        active: false,
        x: 0,
        speed: 14,
        intensity: 0,
    });
    const mousePosRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
    const [isChirping, setIsChirping] = useState(false);

    // Trigger a high-energy acoustic transmission burst
    const triggerBurst = useCallback(() => {
        burstPulseRef.current = {
            active: true,
            x: 0,
            speed: 12,
            intensity: 1.0,
        };
        setIsChirping(true);

        try {
            const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtxClass) {
                const ctx = audioCtxRef.current || new AudioCtxClass();
                audioCtxRef.current = ctx;
                if (ctx.state === "suspended") ctx.resume();

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                // Chirp sweep across FSK acoustic frequencies
                osc.frequency.setValueAtTime(1875, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.35);

                gain.gain.setValueAtTime(0.001, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start();
                osc.stop(ctx.currentTime + 0.4);
            }
        } catch {
            // Audio context not available or user gesture needed
        }

        setTimeout(() => setIsChirping(false), 700);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
        let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

        const handleResize = () => {
            if (!canvas || !canvas.parentElement) return;
            width = canvas.width = canvas.parentElement.clientWidth;
            height = canvas.height = canvas.parentElement.clientHeight;
        };
        window.addEventListener("resize", handleResize);

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mousePosRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                active: true,
            };
        };
        const handleMouseLeave = () => {
            mousePosRef.current.active = false;
        };

        if (interactive) {
            canvas.addEventListener("mousemove", handleMouseMove);
            canvas.addEventListener("mouseleave", handleMouseLeave);
        }

        let time = 0;
        const numLines = 36;

        const render = () => {
            time += 0.018;

            // Update burst pulse
            const pulse = burstPulseRef.current;
            if (pulse.active) {
                pulse.x += pulse.speed;
                pulse.intensity *= 0.985;
                if (pulse.x > width + 400 || pulse.intensity < 0.02) {
                    pulse.active = false;
                }
            }

            ctx.clearRect(0, 0, width, height);

            const centerY = height * 0.5;
            const lineSpacing = height * 0.015;

            // Wave packet centers traveling horizontally across the canvas
            // 1. Blue packet (Arc USDC EIP-3009 tone ~ 1900Hz)
            const bluePacketCenter = ((time * 190) % (width + 700)) - 350;
            // 2. Purple packet (Monad 10k TPS transfer tone ~ 1800Hz)
            const purplePacketCenter = (((time * 140) + width * 0.35) % (width + 700)) - 350;
            // 3. Yellow/Gold packet (ESP32 acoustic signer tone ~ 2100Hz)
            const yellowPacketCenter = (((time * 165) + width * 0.7) % (width + 700)) - 350;
            // 4. Emerald packet (Approve physical actuation ~ 2000Hz)
            const greenPacketCenter = (((time * 120) + width * 0.15) % (width + 700)) - 350;

            for (let i = 0; i < numLines; i++) {
                const lineOffset = (i - numLines / 2) * lineSpacing;
                const baseLineY = centerY + lineOffset;

                ctx.beginPath();
                ctx.lineWidth = 1.2;

                type PacketColor = "grey" | "blue" | "purple" | "yellow" | "green";
                const points: { x: number; y: number; colorType: PacketColor }[] = [];
                const step = 6;

                for (let x = 0; x <= width; x += step) {
                    // Continuous layered harmonics
                    const wave1 = Math.sin(x * 0.0035 + time * 1.4 + i * 0.11) * 24;
                    const wave2 = Math.cos(x * 0.008 - time * 1.6 + i * 0.07) * 16;
                    const wave3 = Math.sin(x * 0.016 + time * 2.0) * 8;

                    // Mouse proximity displacement
                    let mouseBump = 0;
                    if (mousePosRef.current.active) {
                        const distToMouse = Math.hypot(x - mousePosRef.current.x, baseLineY - mousePosRef.current.y);
                        if (distToMouse < 240) {
                            mouseBump = Math.cos((distToMouse / 240) * Math.PI * 0.5) * 32;
                        }
                    }

                    // Acoustic Pulse wave displacement & excitation
                    let pulseBump = 0;
                    let isBlue = false;
                    let isPurple = false;
                    let isYellow = false;
                    let isGreen = false;

                    // Traveling Blue packet
                    const distToBlue = Math.abs(x - bluePacketCenter);
                    if (distToBlue < 190) {
                        const env = Math.cos((distToBlue / 190) * (Math.PI / 2));
                        pulseBump += Math.sin(x * 0.045 + time * 6) * 36 * env;
                        if (distToBlue < 130) isBlue = true;
                    }

                    // Traveling Purple packet
                    const distToPurple = Math.abs(x - purplePacketCenter);
                    if (distToPurple < 210) {
                        const env = Math.cos((distToPurple / 210) * (Math.PI / 2));
                        pulseBump += Math.cos(x * 0.04 - time * 5) * 32 * env;
                        if (distToPurple < 140) isPurple = true;
                    }

                    // Traveling Yellow packet
                    const distToYellow = Math.abs(x - yellowPacketCenter);
                    if (distToYellow < 200) {
                        const env = Math.cos((distToYellow / 200) * (Math.PI / 2));
                        pulseBump += Math.sin(x * 0.052 - time * 6.5) * 30 * env;
                        if (distToYellow < 135) isYellow = true;
                    }

                    // Traveling Green packet
                    const distToGreen = Math.abs(x - greenPacketCenter);
                    if (distToGreen < 180) {
                        const env = Math.cos((distToGreen / 180) * (Math.PI / 2));
                        pulseBump += Math.cos(x * 0.048 + time * 5.5) * 28 * env;
                        if (distToGreen < 120) isGreen = true;
                    }

                    // Manual triggered burst pulse
                    if (pulse.active) {
                        const distToBurst = Math.abs(x - pulse.x);
                        if (distToBurst < 280) {
                            const env = Math.cos((distToBurst / 280) * (Math.PI / 2)) * pulse.intensity;
                            pulseBump += Math.sin(x * 0.06 + time * 12) * 55 * env;
                            if (distToBurst < 150) {
                                if (i % 4 === 0) isBlue = true;
                                else if (i % 4 === 1) isPurple = true;
                                else if (i % 4 === 2) isYellow = true;
                                else isGreen = true;
                            }
                        }
                    }

                    const y = baseLineY + wave1 + wave2 + wave3 + mouseBump + pulseBump;

                    let colorType: PacketColor = "grey";
                    if (isBlue) colorType = "blue";
                    else if (isPurple) colorType = "purple";
                    else if (isYellow) colorType = "yellow";
                    else if (isGreen) colorType = "green";

                    points.push({ x, y, colorType });
                }

                // Render line segments with glowing gradient transitions
                for (let p = 0; p < points.length - 1; p++) {
                    const p1 = points[p];
                    const p2 = points[p + 1];

                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);

                    if (p1.colorType === "blue" || p2.colorType === "blue") {
                        ctx.strokeStyle = "rgba(0, 229, 255, 0.95)"; // Electric Cyan (Arc USDC)
                        ctx.lineWidth = 2.4;
                    } else if (p1.colorType === "purple" || p2.colorType === "purple") {
                        ctx.strokeStyle = "rgba(131, 110, 249, 0.95)"; // Electric Violet (Monad)
                        ctx.lineWidth = 2.4;
                    } else if (p1.colorType === "yellow" || p2.colorType === "yellow") {
                        ctx.strokeStyle = "rgba(255, 196, 0, 0.95)"; // Acoustic Gold (ESP32)
                        ctx.lineWidth = 2.4;
                    } else if (p1.colorType === "green" || p2.colorType === "green") {
                        ctx.strokeStyle = "rgba(16, 185, 129, 0.95)"; // Vibrant Green (Approve)
                        ctx.lineWidth = 2.4;
                    } else {
                        // Ambient dark mode harmonic line
                        const alpha = 0.08 + Math.abs(i - numLines / 2) * 0.004;
                        ctx.strokeStyle = `rgba(131, 110, 249, ${alpha})`;
                        ctx.lineWidth = 1.0;
                    }

                    ctx.stroke();
                }
            }

            animIdRef.current = requestAnimationFrame(render);
        };

        animIdRef.current = requestAnimationFrame(render);

        return () => {
            window.removeEventListener("resize", handleResize);
            if (canvas) {
                canvas.removeEventListener("mousemove", handleMouseMove);
                canvas.removeEventListener("mouseleave", handleMouseLeave);
            }
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => {});
            }
        };
    }, [interactive]);

    return (
        <div className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}>
            <canvas
                ref={canvasRef}
                className="w-full h-full pointer-events-auto block"
            />

            {/* Dark Mode Gradient Overlays for Soft Lighting & Seamless Fade into #050508 */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/80 via-transparent to-[#050508] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/90 via-transparent to-[#050508]/90 pointer-events-none" />

            {/* Optional Audio Wave Legend / Trigger Overlay in Hero bottom-center */}
            {showControls && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-3 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg text-xs font-mono text-white">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_6px_rgba(0,229,255,0.7)]" />
                            <span className="text-[10px] text-neutral-300">Arc USDC</span>
                        </span>
                        <span className="text-white/20">|</span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#836EF9] shadow-[0_0_6px_rgba(131,110,249,0.7)]" />
                            <span className="text-[10px] text-neutral-300">Monad FSK</span>
                        </span>
                        <span className="text-white/20">|</span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#FFC400] shadow-[0_0_6px_rgba(255,196,0,0.7)]" />
                            <span className="text-[10px] text-neutral-300">ESP32 Auth</span>
                        </span>
                    </div>

                    <span className="text-white/20">|</span>

                    <button
                        type="button"
                        onClick={triggerBurst}
                        disabled={isChirping}
                        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-full text-[10px] font-mono transition-all disabled:opacity-60 cursor-pointer"
                    >
                        <Volume2 size={11} className={isChirping ? "text-[#FFD600] animate-bounce" : "text-[#00E5FF]"} />
                        <span>{isChirping ? "Emitting FSK Waves..." : "Pulse Acoustic Wave"}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
