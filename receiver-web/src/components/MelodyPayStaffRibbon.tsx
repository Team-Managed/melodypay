import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { motion } from "framer-motion";

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

// Full 2D Cursive Calligraphy Path for "melodypay" aligned on the SAME HORIZONTAL BASELINE AXIS (Y = 280)
// Coordinate space: 1400 x 600
const CURSIVE_MELODYPAY_ALIGNED_PATH = `
M 40 180
L 100 180
C 120 180, 135 230, 145 280
C 150 250, 160 200, 175 200
C 190 200, 195 260, 205 280
C 210 250, 220 200, 235 200
C 250 200, 255 260, 265 280
C 270 250, 280 200, 295 200
C 310 200, 315 260, 325 280
C 335 280, 345 255, 355 235
C 365 210, 380 195, 395 195
C 405 195, 405 225, 390 245
C 375 265, 385 280, 410 280
C 430 280, 445 180, 460 85
C 468 65, 478 75, 475 105
C 465 155, 460 235, 468 280
C 475 285, 485 275, 495 245
C 505 220, 520 195, 545 195
C 520 195, 508 230, 512 260
C 518 280, 545 280, 560 255
C 570 230, 565 200, 545 195
C 560 195, 580 220, 595 235
C 580 240, 568 260, 572 270
C 578 280, 605 280, 615 260
C 625 235, 625 180, 625 85
C 625 70, 628 75, 628 105
C 628 180, 626 250, 630 280
C 635 285, 650 270, 660 240
C 670 215, 680 200, 690 200
C 700 200, 705 260, 715 280
C 725 260, 735 215, 745 200
C 750 220, 750 330, 750 435
C 750 465, 725 465, 715 445
C 705 420, 725 385, 755 350
C 770 320, 785 285, 805 280
C 820 280, 835 280, 850 280
C 860 250, 870 200, 880 200
C 880 250, 875 350, 875 445
C 875 400, 878 320, 880 280
C 895 210, 925 210, 930 245
C 935 280, 905 285, 880 280
C 895 280, 910 265, 925 245
C 940 220, 955 200, 970 200
C 955 200, 940 235, 945 265
C 950 280, 975 280, 990 260
C 1000 235, 1000 210, 975 200
C 995 220, 995 260, 998 280
C 1005 285, 1020 270, 1035 240
C 1045 215, 1055 200, 1065 200
C 1075 200, 1080 260, 1090 280
C 1100 260, 1110 215, 1120 200
C 1125 220, 1125 330, 1125 450
C 1125 490, 1085 490, 1065 455
C 1045 420, 1085 375, 1130 340
C 1155 320, 1185 335, 1215 340
C 1245 350, 1280 380, 1340 380
`.replace(/\n/g, " ").trim();

// Color definitions for Blue, Pink, and Purple palette
const STAFF_COLORS = [
    { base: "rgba(0, 136, 255, 0.48)", pulse: "rgba(0, 140, 255, 1.0)", glow: "rgba(0, 136, 255, 0.9)", name: "Electric Blue" },
    { base: "rgba(244, 63, 142, 0.48)", pulse: "rgba(255, 46, 147, 1.0)", glow: "rgba(244, 63, 142, 0.9)", name: "Vibrant Pink" },
    { base: "rgba(139, 92, 246, 0.52)", pulse: "rgba(147, 51, 234, 1.0)", glow: "rgba(139, 92, 246, 0.95)", name: "Royal Purple" },
    { base: "rgba(217, 70, 239, 0.48)", pulse: "rgba(232, 121, 249, 1.0)", glow: "rgba(217, 70, 239, 0.9)", name: "Deep Pink" },
    { base: "rgba(37, 99, 235, 0.48)", pulse: "rgba(59, 130, 246, 1.0)", glow: "rgba(37, 99, 235, 0.9)", name: "Cobalt Blue" },
];

export function MelodyPayStaffRibbon() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const animIdRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const playheadTRef = useRef<number>(0);
    const lastNoteRef = useRef<number>(-1);

    // Notes mapped across the "melodypay" cursive letters
    const NOTES: Note[] = [
        { t: 0.08, lineOffset: 1, symbol: "♪", freq: 1875, label: "F0: 1875Hz", color: "#0088FF" },
        { t: 0.20, lineOffset: -1, symbol: "♫", freq: 1950, label: "MAGIC: 0x4D", color: "#EC4899" },
        { t: 0.30, lineOffset: 2, symbol: "♪", freq: 2031, label: "EIP-3009", color: "#8B5CF6" },
        { t: 0.44, lineOffset: 0, symbol: "♬", freq: 2080, label: "USDC: 6dec", color: "#00E5FF" },
        { t: 0.55, lineOffset: -2, symbol: "♫", freq: 2150, label: "ARC: 5042002", color: "#D946EF" },
        { t: 0.67, lineOffset: 1, symbol: "♪", freq: 1980, label: "MONAD: 10143", color: "#8B5CF6" },
        { t: 0.80, lineOffset: -1, symbol: "♫", freq: 2187, label: "F1: 2187Hz", color: "#F43F5E" },
        { t: 0.93, lineOffset: 0, symbol: "♪", freq: 2200, label: "CRC-8 OK", color: "#0088FF" },
    ];

    // Chime synthesizer: completely silent per user requirement
    const playChime = useCallback((_freq: number) => {
        return;
    }, []);

    // IntersectionObserver: Only render footer animation when scrolled into view!
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0.05 }
        );
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return; // Pause rendering completely when out of view!

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = 0;
        let height = 0;

        // Precompute path points once
        const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        svgPath.setAttribute("d", CURSIVE_MELODYPAY_ALIGNED_PATH);
        const totalLength = svgPath.getTotalLength();

        const samples = 500;
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
                normX: pt.x / 1400,
                normY: pt.y / 600,
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
        const lineSpacing = 5.8;
        let frameCount = 0;

        const render = () => {
            frameCount++;
            if (isPlaying) {
                playheadTRef.current = (playheadTRef.current + 0.006) % 1.0;
            }

            ctx.clearRect(0, 0, width, height);

            const playheadU = playheadTRef.current;

            // Trigger chimes
            for (let n = 0; n < NOTES.length; n++) {
                const note = NOTES[n];
                if (Math.abs(playheadU - note.t) < 0.008 && lastNoteRef.current !== n) {
                    lastNoteRef.current = n;
                    playChime(note.freq);
                    break;
                }
            }
            if (NOTES.every(n => Math.abs(playheadU - n.t) >= 0.012)) {
                lastNoteRef.current = -1;
            }

            // Draw 5 continuous staff lines (fast batched stroke)
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
                ctx.lineWidth = 1.35;
                ctx.stroke();

                // Draw wave pulse highlight segment (only ~20 vertices, strict contiguous slices)
                const pulseWidth = 0.08;
                const windowSamples = Math.round(pulseWidth * samples);
                const centerS = Math.round(playheadU * samples);

                const drawSlice = (s0: number, s1: number) => {
                    if (s0 >= s1) return;
                    ctx.beginPath();
                    for (let s = s0; s <= s1; s++) {
                        const p = precomputedPoints[s];
                        const px = p.normX * width + p.nx * baseOffset;
                        const py = p.normY * height + p.ny * baseOffset;
                        if (s === s0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.save();
                    ctx.strokeStyle = colorConfig.pulse;
                    ctx.lineWidth = 3.0;
                    ctx.shadowColor = colorConfig.glow;
                    ctx.shadowBlur = 10;
                    ctx.stroke();
                    ctx.restore();
                };

                const sStart = centerS - windowSamples;
                const sEnd = centerS + windowSamples;

                if (sStart >= 0 && sEnd <= samples) {
                    drawSlice(sStart, sEnd);
                } else if (sStart < 0) {
                    drawSlice(0, sEnd);
                    drawSlice(samples + sStart, samples);
                } else {
                    drawSlice(sStart, samples);
                    drawSlice(0, sEnd - samples);
                }
            }

            // Draw notes
            for (let i = 0; i < NOTES.length; i++) {
                const note = NOTES[i];
                const sampleIndex = Math.min(samples, Math.floor(note.t * samples));
                const pn = precomputedPoints[sampleIndex];
                const offset = note.lineOffset * lineSpacing;
                const noteX = pn.normX * width + pn.nx * offset;
                const noteY = pn.normY * height + pn.ny * offset;

                const isNearPlayhead = Math.abs(playheadU - note.t) < 0.045;

                ctx.save();
                ctx.font = isNearPlayhead ? "bold 15px sans-serif" : "12px sans-serif";
                ctx.fillStyle = isNearPlayhead ? note.color : "#1E1B4B";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                if (isNearPlayhead) {
                    ctx.shadowColor = note.color;
                    ctx.shadowBlur = 8;
                }
                ctx.fillText(note.symbol, noteX, noteY);
                ctx.restore();
            }

            animIdRef.current = requestAnimationFrame(render);
        };

        animIdRef.current = requestAnimationFrame(render);

        return () => {
            window.removeEventListener("resize", handleResize);
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => {});
            }
        };
    }, [isPlaying, isMuted, playChime, isVisible]);

    const togglePlaying = () => setIsPlaying(!isPlaying);
    const toggleMute = () => setIsMuted(!isMuted);

    return (
        <div ref={containerRef} className="w-full h-full relative select-none flex flex-col items-center justify-center">
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
            />

            {/* Subtle control dock */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center justify-center gap-3.5 text-xs font-mono bg-[#FFFFFF]/95 backdrop-blur-md px-4 py-1.5 rounded-full border border-[#E2E2DA] shadow-xs z-30"
            >
                <motion.button
                    type="button"
                    onClick={togglePlaying}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 text-[#111113] hover:text-[#8B5CF6] transition-colors font-medium cursor-pointer"
                >
                    {isPlaying ? (
                        <>
                            <Pause size={12} className="text-[#8B5CF6]" />
                            <span className="underline decoration-dotted underline-offset-4">pause</span>
                        </>
                    ) : (
                        <>
                            <Play size={12} className="text-[#EC4899]" />
                            <span className="underline decoration-dotted underline-offset-4">play</span>
                        </>
                    )}
                </motion.button>

                <span className="text-[#E2E2DA]">|</span>

                <motion.button
                    type="button"
                    onClick={toggleMute}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 text-[#7A7A85] hover:text-[#111113] transition-colors cursor-pointer"
                >
                    {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} className="text-[#0088FF]" />}
                    <span className="text-[11px]">{isMuted ? "muted" : "chimes on"}</span>
                </motion.button>

                <span className="text-[#E2E2DA] hidden sm:inline">|</span>

                <div className="flex items-center gap-1.5 text-[11px] text-[#7A7A85] hidden sm:flex">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EC4899] animate-pulse" />
                    <span className="text-[#111113]">ESP32</span>
                    <span className="text-[#C4B5FD]">➔</span>
                    <span className="font-semibold bg-gradient-to-r from-[#0088FF] via-[#EC4899] to-[#8B5CF6] bg-clip-text text-transparent">melodypay</span>
                    <span className="text-[#C4B5FD]">➔</span>
                    <span className="text-[#111113]">Hand POS</span>
                </div>
            </motion.div>
        </div>
    );
}
