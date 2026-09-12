import { useEffect, useRef, useState, useCallback } from "react";

interface Note {
    t: number; // 0 to 1 along curve
    lineOffset: number; // -2 to 2
    symbol: string;
    freq: number;
    label: string;
    color: string;
}

interface PathSample {
    normX: number;
    normY: number;
    nx: number;
    ny: number;
    u: number;
}

// Master 2D Silky Cursive Calligraphy Path for "Pay with Sound"
// Engineered with open, rounded loops and a textbook Spencerian Cursive 'S':
// - Ingress from ESP32 Sound Wallet (X: 40, Y: 160)
// - "Pay": Upper tier (baseline Y ~ 230, X: 90 -> 370)
// - "with": Middle tier (baseline Y ~ 310, X: 390 -> 760)
// - "Sound": Lower tier with unmistakable cursive 'S' (baseline Y ~ 390, X: 780 -> 1280)
//   * 'S' Anatomy: diagonal upstroke (X: 805->860, Y: 375->180) -> apex crest (Y: 170) ->
//     serpentine waist curving down-left (X: 835, Y: 295) -> wide sweeping lower belly (Y: 390, X: 815->925) ->
//     inner clasp and flourish into 'o'
// - Egress into Receiving POS Hand (X: 1320, Y: 410)
// Coordinate space: 1400 x 540
const CURSIVE_PAYWITHSOUND_PATH = `
M 40 160
L 90 160
C 105 160, 115 170, 120 180
C 120 220, 120 270, 120 310
C 110 330, 90 330, 85 305
C 80 260, 80 180, 100 110
C 115 75, 160 75, 180 105
C 200 135, 195 175, 150 185
C 130 190, 120 185, 135 180
C 150 175, 165 190, 180 200
C 190 180, 205 175, 210 185
C 190 185, 175 200, 175 220
C 175 240, 195 245, 210 230
C 215 220, 215 195, 215 190
C 215 210, 215 235, 230 235
C 235 235, 245 220, 255 210
C 260 215, 265 240, 280 240
C 290 240, 295 220, 300 210
C 300 230, 300 280, 295 330
C 290 370, 260 370, 245 340
C 235 305, 265 280, 295 265
C 320 250, 355 260, 385 270
C 395 275, 405 285, 415 310
C 425 330, 440 330, 450 300
C 455 285, 465 285, 470 300
C 475 330, 490 330, 500 300
C 505 285, 515 280, 530 280
C 535 275, 545 265, 550 265
C 555 275, 555 315, 570 315
C 575 315, 580 300, 590 285
C 595 265, 605 225, 610 190
C 612 180, 620 180, 620 195
C 620 235, 618 290, 625 315
C 630 318, 640 310, 650 290
C 655 270, 670 215, 680 185
C 685 175, 695 175, 695 195
C 695 235, 690 285, 690 315
C 690 285, 705 265, 725 265
C 740 265, 745 295, 750 315
C 755 325, 765 345, 775 365
C 785 385, 810 385, 825 365
C 835 345, 845 250, 860 190
C 868 165, 895 165, 895 195
C 895 230, 850 265, 835 295
C 815 335, 825 390, 885 390
C 915 390, 930 365, 925 340
C 920 325, 895 330, 885 345
C 880 360, 905 360, 925 345
C 935 330, 955 330, 965 350
C 975 370, 970 385, 950 385
C 930 385, 930 360, 945 345
C 955 335, 965 335, 980 345
C 985 355, 990 385, 1005 385
C 1020 385, 1025 360, 1030 345
C 1035 360, 1040 385, 1055 385
C 1065 385, 1070 365, 1080 350
C 1085 335, 1095 335, 1105 355
C 1115 375, 1115 385, 1120 385
C 1125 355, 1135 335, 1150 335
C 1160 355, 1165 375, 1170 385
C 1180 365, 1175 345, 1195 345
C 1210 345, 1210 385, 1195 385
C 1185 385, 1205 375, 1215 355
C 1220 315, 1225 210, 1230 190
C 1232 180, 1240 180, 1240 195
C 1240 250, 1238 360, 1245 385
C 1250 395, 1275 405, 1310 410
L 1350 410
`.replace(/\n/g, " ").trim();

// Color definitions: Pure Glowing White Palette for maximum contrast & ethereal beauty
const STAFF_COLORS = [
    { base: "rgba(255, 255, 255, 0.45)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 1" },
    { base: "rgba(255, 255, 255, 0.60)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 2" },
    { base: "rgba(255, 255, 255, 0.75)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 3" },
    { base: "rgba(255, 255, 255, 0.60)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 4" },
    { base: "rgba(255, 255, 255, 0.45)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 5" },
];

interface PayForSoundStaffRibbonProps {
    className?: string;
    showControls?: boolean;
}

export function PayForSoundStaffRibbon({ className = "", showControls = true }: PayForSoundStaffRibbonProps = {}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const animIdRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const playheadTRef = useRef<number>(0);
    const lastNoteRef = useRef<number>(-1);

    // Notes mapped across the "Pay with Sound" cursive letters in glowing white
    const NOTES: Note[] = [
        { t: 0.08, lineOffset: 1, symbol: "♪", freq: 1875, label: "F0: 1875Hz", color: "#FFFFFF" },
        { t: 0.18, lineOffset: -1, symbol: "♫", freq: 1950, label: "PAY: 0x4D", color: "#FFFFFF" },
        { t: 0.32, lineOffset: 2, symbol: "♪", freq: 2031, label: "EIP-3009", color: "#FFFFFF" },
        { t: 0.46, lineOffset: 0, symbol: "♬", freq: 2080, label: "WITH: ARC", color: "#FFFFFF" },
        { t: 0.58, lineOffset: -2, symbol: "♫", freq: 2150, label: "USDC: 6dec", color: "#FFFFFF" },
        { t: 0.70, lineOffset: 1, symbol: "♪", freq: 1980, label: "SOUND: MONAD", color: "#FFFFFF" },
        { t: 0.82, lineOffset: -1, symbol: "♫", freq: 2187, label: "F1: 2187Hz", color: "#FFFFFF" },
        { t: 0.94, lineOffset: 0, symbol: "♪", freq: 2200, label: "CRC-8 OK", color: "#FFFFFF" },
    ];

    // Chime synthesizer
    const playChime = useCallback((freq: number) => {
        if (isMuted) return;
        try {
            const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtxClass) return;

            const ctx = audioCtxRef.current || new AudioCtxClass();
            audioCtxRef.current = ctx;
            if (ctx.state === "suspended") ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            gain.gain.setValueAtTime(0.001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch {
            // Audio context guard
        }
    }, [isMuted]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = 0;
        let height = 0;

        // 1. PRECOMPUTE PATH POINTS & NORMALS EXACTLY ONCE (ZERO DOM CALLS IN ANIMATION LOOP!)
        const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        svgPath.setAttribute("d", CURSIVE_PAYWITHSOUND_PATH);
        const totalLength = svgPath.getTotalLength();

        const samples = 650;
        const delta = 2.0;
        const precomputedPoints: PathSample[] = [];

        for (let s = 0; s <= samples; s++) {
            const dist = (s / samples) * totalLength;
            const pt = svgPath.getPointAtLength(dist);
            const ptPrev = svgPath.getPointAtLength(Math.max(0, dist - delta));
            const ptNext = svgPath.getPointAtLength(Math.min(totalLength, dist + delta));

            const dx = ptNext.x - ptPrev.x;
            const dy = ptNext.y - ptPrev.y;
            const len = Math.hypot(dx, dy) || 1;

            precomputedPoints.push({
                normX: pt.x / 1420,
                normY: pt.y / 540,
                nx: -dy / len,
                ny: dx / len,
                u: s / samples,
            });
        }

        const updateDimensions = () => {
            if (!canvas || !canvas.parentElement) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = canvas.parentElement.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.resetTransform();
            ctx.scale(dpr, dpr);
        };
        updateDimensions();

        const handleResize = () => {
            updateDimensions();
        };
        window.addEventListener("resize", handleResize);

        const numStaffLines = 5;
        const lineSpacing = 5.6;
        let frameCount = 0;

        // 1 single graceful traveling wave pulse
        const PULSE_OFFSETS = [0];
        // Slow, calm, graceful musical speed (~10s per complete cycle at 60 FPS)
        const speedStep = 0.0016;

        const render = () => {
            frameCount++;
            if (isPlaying) {
                playheadTRef.current = (playheadTRef.current + speedStep) % 1.0;
            }

            ctx.clearRect(0, 0, width, height);

            const playheadU = playheadTRef.current;

            // Trigger chimes calmly when primary pulse reaches notes
            for (let n = 0; n < NOTES.length; n++) {
                const note = NOTES[n];
                if (Math.abs(playheadU - note.t) < 0.004 && lastNoteRef.current !== n) {
                    lastNoteRef.current = n;
                    playChime(note.freq);
                    break;
                }
            }
            if (NOTES.every(n => Math.abs(playheadU - n.t) >= 0.007)) {
                lastNoteRef.current = -1;
            }

            // 0. AMBIENT BACKGROUND CARRIER WAVES (Soft white fluid drift)
            ctx.save();
            const time = frameCount * 0.01;
            const bgWaveColors = [
                "rgba(255, 255, 255, 0.04)",
                "rgba(255, 255, 255, 0.07)",
                "rgba(255, 255, 255, 0.09)",
                "rgba(255, 255, 255, 0.07)",
                "rgba(255, 255, 255, 0.05)",
                "rgba(255, 255, 255, 0.04)",
            ];
            for (let w = 0; w < bgWaveColors.length; w++) {
                const progress = w / (bgWaveColors.length - 1);
                const baseY = height * (0.08 + progress * 0.84);
                const freq = 0.0022 + (w % 3) * 0.001;
                const amp = 12 + (w % 3) * 6;
                const phase = time * (0.6 + w * 0.15);

                ctx.beginPath();
                ctx.moveTo(0, baseY + Math.sin(phase) * amp);
                for (let x = 0; x <= width; x += 30) {
                    ctx.lineTo(x, baseY + Math.sin(x * freq + phase) * amp);
                }
                ctx.strokeStyle = bgWaveColors[w];
                ctx.lineWidth = 1.0;
                ctx.stroke();
            }
            ctx.restore();

            // 1. HARDWARE WALLET (Left)
            const pStart = precomputedPoints[0];
            const startX = pStart.normX * width;
            const startY = pStart.normY * height;
            const hwW = 74;
            const hwH = 92;
            const hwX = startX - hwW - 8;
            const hwY = startY - hwH / 2;

            ctx.save();
            ctx.fillStyle = "rgba(10, 15, 12, 0.85)";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(hwX, hwY, hwW, hwH, 8);
            ctx.fill();
            ctx.stroke();

            // OLED screen
            ctx.fillStyle = "#000000";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(hwX + 8, hwY + 10, hwW - 16, 30, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText("0.01 USDC", hwX + hwW / 2, hwY + 22);
            ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
            ctx.font = "6px 'JetBrains Mono', monospace";
            ctx.fillText("READY // AIRGAP", hwX + hwW / 2, hwY + 33);

            // Buttons
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(hwX + 22, hwY + 56, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.beginPath();
            ctx.arc(hwX + hwW - 22, hwY + 56, 5, 0, Math.PI * 2);
            ctx.fill();

            // Speaker rings (White acoustic emission waves)
            const ringColors = ["rgba(255, 255, 255, 0.9)", "rgba(255, 255, 255, 0.6)", "rgba(255, 255, 255, 0.35)"];
            for (let r = 0; r < 3; r++) {
                ctx.beginPath();
                ctx.arc(hwX + hwW / 2, hwY + 74, 3 + r * 3.8, 0, Math.PI * 2);
                ctx.strokeStyle = ringColors[r];
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 8px 'JetBrains Mono', monospace";
            ctx.fillText("ESP32 SOUND WALLET", hwX + hwW / 2, hwY - 6);
            ctx.restore();

            // 2. RECEIVER HAND (Right)
            const pEnd = precomputedPoints[samples];
            const handX = pEnd.normX * width + 8;
            const handY = pEnd.normY * height;

            ctx.save();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2.0;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            ctx.moveTo(handX + 54, handY + 26);
            ctx.lineTo(handX + 36, handY + 16);
            ctx.quadraticCurveTo(handX + 24, handY + 10, handX + 18, handY - 4);
            ctx.quadraticCurveTo(handX + 10, handY - 14, handX + 20, handY - 20);
            ctx.quadraticCurveTo(handX + 26, handY - 16, handX + 28, handY - 4);
            ctx.quadraticCurveTo(handX + 20, handY - 8, handX + 6, handY - 12);
            ctx.quadraticCurveTo(handX - 2, handY - 12, handX + 4, handY - 6);
            ctx.quadraticCurveTo(handX - 6, handY - 4, handX - 10, handY);
            ctx.quadraticCurveTo(handX - 6, handY + 4, handX + 4, handY + 4);
            ctx.quadraticCurveTo(handX - 2, handY + 8, handX + 6, handY + 12);
            ctx.quadraticCurveTo(handX + 16, handY + 16, handX + 34, handY + 22);
            ctx.lineTo(handX + 56, handY + 34);
            ctx.stroke();

            for (let r = 0; r < 3; r++) {
                ctx.beginPath();
                ctx.arc(handX - 10, handY, 6 + r * 4, -Math.PI * 0.4, Math.PI * 0.4);
                ctx.strokeStyle = ringColors[r];
                ctx.lineWidth = 1.3;
                ctx.stroke();
            }

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 8px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText("RECEIVER POS // MIC", handX + 28, handY - 26);
            ctx.restore();

            // 3. DRAW 5 BASE PARALLEL STAFF LINES (Clean, razor-sharp calligraphy curves)
            for (let l = 0; l < numStaffLines; l++) {
                const baseOffset = (l - (numStaffLines - 1) / 2) * lineSpacing;
                const colorConfig = STAFF_COLORS[l % STAFF_COLORS.length];

                ctx.beginPath();
                for (let s = 0; s <= samples; s++) {
                    const p = precomputedPoints[s];
                    const px = p.normX * width + p.nx * baseOffset;
                    const py = p.normY * height + p.ny * baseOffset;

                    if (s === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = colorConfig.base;
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }

            // 4. DRAW TRAVELING WAVE PULSES (Strict slice drawing in bright glowing pure white)
            ctx.save();
            const pulseWidth = 0.08;
            const windowSamples = Math.round(pulseWidth * samples);

            const drawPulseSlice = (s0: number, s1: number) => {
                if (s0 >= s1) return;
                for (let l = 0; l < numStaffLines; l++) {
                    const baseOffset = (l - (numStaffLines - 1) / 2) * lineSpacing;

                    ctx.beginPath();
                    for (let s = s0; s <= s1; s++) {
                        const pt = precomputedPoints[s];
                        const px = pt.normX * width + pt.nx * baseOffset;
                        const py = pt.normY * height + pt.ny * baseOffset;

                        if (s === s0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.strokeStyle = "#FFFFFF";
                    ctx.lineWidth = 3.2;
                    ctx.shadowColor = "rgba(255, 255, 255, 1.0)";
                    ctx.shadowBlur = 16;
                    ctx.stroke();
                }
            };

            for (let p = 0; p < PULSE_OFFSETS.length; p++) {
                const pU = (playheadU + PULSE_OFFSETS[p]) % 1.0;
                const centerS = Math.round(pU * samples);

                const sStart = centerS - windowSamples;
                const sEnd = centerS + windowSamples;

                if (sStart >= 0 && sEnd <= samples) {
                    drawPulseSlice(sStart, sEnd);
                } else if (sStart < 0) {
                    drawPulseSlice(0, sEnd);
                    drawPulseSlice(samples + sStart, samples);
                } else {
                    drawPulseSlice(sStart, samples);
                    drawPulseSlice(0, sEnd - samples);
                }
            }
            ctx.restore();

            // 5. DRAW GENTLE DRIFTING LIGHT PARTICLES (5 glowing white luminous sparks)
            for (let p = 0; p < 5; p++) {
                const pU = (frameCount * 0.002 + p * 0.2) % 1.0;
                const sampleIndex = Math.min(samples, Math.floor(pU * samples));
                const pn = precomputedPoints[sampleIndex];
                const lineIdx = p % numStaffLines;
                const offset = (lineIdx - (numStaffLines - 1) / 2) * lineSpacing;
                const px = pn.normX * width + pn.nx * offset;
                const py = pn.normY * height + pn.ny * offset;

                ctx.save();
                ctx.beginPath();
                ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = "#FFFFFF";
                ctx.shadowColor = "rgba(255, 255, 255, 1.0)";
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.restore();
            }

            // 6. DRAW MUSICAL NOTES & FREQUENCIES (Crisp white notation)
            for (let i = 0; i < NOTES.length; i++) {
                const note = NOTES[i];
                const sampleIndex = Math.min(samples, Math.floor(note.t * samples));
                const pn = precomputedPoints[sampleIndex];
                const offset = note.lineOffset * lineSpacing;
                const noteX = pn.normX * width + pn.nx * offset;
                const noteY = pn.normY * height + pn.ny * offset;

                let isNearPulse = false;
                for (let p = 0; p < PULSE_OFFSETS.length; p++) {
                    const pU = (playheadU + PULSE_OFFSETS[p]) % 1.0;
                    if (Math.abs(pU - note.t) < 0.05) {
                        isNearPulse = true;
                        break;
                    }
                }

                ctx.save();
                ctx.font = isNearPulse ? "bold 16px sans-serif" : "13px sans-serif";
                ctx.fillStyle = "#FFFFFF";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                if (isNearPulse) {
                    ctx.shadowColor = "rgba(255, 255, 255, 1.0)";
                    ctx.shadowBlur = 14;
                } else {
                    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                    ctx.shadowBlur = 4;
                }
                ctx.fillText(note.symbol, noteX, noteY);

                ctx.font = "8.5px 'JetBrains Mono', monospace";
                ctx.fillStyle = isNearPulse ? "#FFFFFF" : "rgba(255, 255, 255, 0.85)";
                ctx.fillText(note.label, noteX, noteY + (note.lineOffset >= 0 ? 13 : -13));
                ctx.restore();
            }

            animIdRef.current = requestAnimationFrame(render);
        };

        animIdRef.current = requestAnimationFrame(render);

        return () => {
            window.removeEventListener("resize", handleResize);
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => { });
            }
        };
    }, [isPlaying, isMuted, playChime]);

    return (
        <div ref={containerRef} className={`w-full h-full relative select-none flex flex-col items-center justify-center pointer-events-none ${className}`}>
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
            />
            {showControls && (
                <div className="absolute bottom-3 right-3 pointer-events-auto flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-3 py-1 text-white text-[10px] font-mono z-20 shadow-md">
                    <button
                        type="button"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="hover:text-[#00E5FF] transition-colors p-0.5 cursor-pointer"
                        title={isPlaying ? "Pause stave wave" : "Play stave wave"}
                    >
                        {isPlaying ? "Pause" : "Play"}
                    </button>
                    <span className="opacity-40">|</span>
                    <button
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className="hover:text-[#00E5FF] transition-colors p-0.5 cursor-pointer"
                        title={isMuted ? "Unmute chime synthesizer" : "Mute chime synthesizer"}
                    >
                        {isMuted ? "Unmute" : "Chimes"}
                    </button>
                </div>
            )}
        </div>
    );
}
