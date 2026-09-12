import { useEffect, useRef, useState } from "react";

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

// Master 2D Compact & Cohesive Spencerian Cursive Calligraphy Path for "melodypay"
// Engineered so the word is naturally proportioned, tightly kerned, and centered:
// - Left undulating stave entrance: (X: 40 -> 380, Y: 280)
// - "m": compact 3 arches (X: 385 -> 475, baseline Y: 280, crests Y: 210)
// - "e": tight loop (X: 475 -> 515)
// - "l": graceful tall ascender (X: 515 -> 560, crest Y: 110)
// - "o": compact oval (X: 560 -> 610)
// - "d": compact oval with tall ascender stem (X: 610 -> 665, crest Y: 105)
// - "y": compact cup with graceful descender loop (X: 665 -> 735, descender Y: 410)
// - "p": compact stem and rounded bulb (X: 735 -> 805, stem Y: 410)
// - "a": compact oval and downstem (X: 805 -> 860)
// - "y": compact cup with graceful descender loop (X: 860 -> 935, descender Y: 410)
// - Right undulating stave egress: (X: 935 -> 1380, Y: 280)
// Coordinate space: 1420 x 540
const CURSIVE_MELODYPAY_ALIGNED_PATH = `
M 40 280
C 120 280, 160 260, 220 260
C 280 260, 320 290, 380 280
C 390 250, 395 210, 405 210
C 415 210, 418 250, 420 280
C 425 240, 430 210, 440 210
C 448 210, 450 250, 452 280
C 455 240, 460 210, 470 210
C 478 210, 480 260, 485 280
C 495 280, 510 245, 520 225
C 525 210, 515 210, 505 225
C 495 245, 505 280, 520 280
C 535 280, 550 180, 560 120
C 565 95, 555 95, 545 125
C 538 160, 542 245, 550 280
C 555 285, 560 285, 568 280
C 578 260, 588 220, 600 220
C 585 220, 580 250, 580 265
C 580 285, 595 285, 605 280
C 615 275, 615 235, 602 225
C 595 220, 608 220, 618 230
C 610 240, 605 260, 615 275
C 625 285, 638 285, 642 270
C 642 240, 642 160, 645 110
C 648 95, 655 95, 655 115
C 655 170, 652 250, 655 280
C 660 285, 668 285, 675 280
C 685 255, 690 220, 700 220
C 708 220, 710 255, 715 275
C 720 265, 725 235, 730 220
C 735 220, 738 310, 738 380
C 738 420, 720 435, 705 415
C 695 395, 710 350, 735 305
C 745 285, 755 280, 765 280
C 772 260, 778 225, 782 225
C 782 250, 778 340, 778 410
C 778 350, 780 270, 788 245
C 795 220, 815 220, 820 245
C 825 270, 805 285, 790 280
C 800 280, 810 280, 820 280
C 830 250, 840 220, 850 220
C 838 220, 832 250, 832 265
C 832 285, 845 285, 855 275
C 860 250, 860 230, 860 250
C 860 265, 860 280, 868 280
C 878 255, 882 220, 892 220
C 900 220, 902 255, 908 275
C 912 265, 918 235, 922 220
C 926 220, 928 310, 928 380
C 928 420, 912 435, 898 415
C 888 395, 905 350, 930 305
C 940 285, 955 280, 970 280
C 1030 280, 1080 260, 1140 260
C 1200 260, 1260 290, 1320 280
L 1380 280
`.replace(/\n/g, " ").trim();

// Color definitions: Pure Glowing White Palette matching "Pay with sound" identically
const STAFF_COLORS = [
    { base: "rgba(255, 255, 255, 0.45)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 1" },
    { base: "rgba(255, 255, 255, 0.60)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 2" },
    { base: "rgba(255, 255, 255, 0.75)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 3" },
    { base: "rgba(255, 255, 255, 0.60)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 4" },
    { base: "rgba(255, 255, 255, 0.45)", pulse: "rgba(255, 255, 255, 1.0)", glow: "rgba(255, 255, 255, 1.0)", name: "Pure White 5" },
];

interface MelodyPayStaffRibbonProps {
    className?: string;
    showControls?: boolean;
}

export function MelodyPayStaffRibbon({ className = "", showControls = false }: MelodyPayStaffRibbonProps = {}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const animIdRef = useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const playheadTRef = useRef<number>(0);

    // Notes mapped directly across the "melodypay" cursive letters
    const NOTES: Note[] = [
        { t: 0.12, lineOffset: 1, symbol: "♪", freq: 1875, label: "F0: 1875Hz", color: "#FFFFFF" },
        { t: 0.30, lineOffset: -1, symbol: "♫", freq: 1950, label: "MELODY: 0x4D", color: "#FFFFFF" },
        { t: 0.42, lineOffset: 2, symbol: "♪", freq: 2031, label: "EIP-3009", color: "#FFFFFF" },
        { t: 0.52, lineOffset: 0, symbol: "♬", freq: 2080, label: "USDC: 6dec", color: "#FFFFFF" },
        { t: 0.62, lineOffset: -2, symbol: "♫", freq: 2150, label: "ARC: 5042002", color: "#FFFFFF" },
        { t: 0.72, lineOffset: 1, symbol: "♪", freq: 1980, label: "MONAD: 10143", color: "#FFFFFF" },
        { t: 0.82, lineOffset: -1, symbol: "♫", freq: 2187, label: "F1: 2187Hz", color: "#FFFFFF" },
        { t: 0.94, lineOffset: 0, symbol: "♪", freq: 2200, label: "CRC-8 OK", color: "#FFFFFF" },
    ];

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
        if (!isVisible) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = 0;
        let height = 0;

        // 1. PRECOMPUTE PATH POINTS & NORMALS EXACTLY ONCE
        const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        svgPath.setAttribute("d", CURSIVE_MELODYPAY_ALIGNED_PATH);
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

        // 1 single graceful traveling wave pulse (matching hero ribbon)
        const PULSE_OFFSETS = [0];
        // Slower, calm, meditative musical tempo (~15s per complete traversal at 60 FPS)
        const speedStep = 0.0011;

        const render = () => {
            frameCount++;
            if (isPlaying) {
                playheadTRef.current = (playheadTRef.current + speedStep) % 1.0;
            }

            const playheadU = playheadTRef.current;

            ctx.clearRect(0, 0, width, height);

            // 1. ESP32 SOUND WALLET DEVICE (Left)
            const pStart = precomputedPoints[0];
            const startX = pStart.normX * width;
            const startY = pStart.normY * height;
            const hwW = 70;
            const hwH = 88;
            const hwX = startX - hwW - 8;
            const hwY = startY - hwH / 2;

            ctx.save();
            ctx.fillStyle = "rgba(18, 18, 22, 0.9)";
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
            ctx.roundRect(hwX + 8, hwY + 10, hwW - 16, 28, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText("0.01 USDC", hwX + hwW / 2, hwY + 22);
            ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
            ctx.font = "6px 'JetBrains Mono', monospace";
            ctx.fillText("READY // AIRGAP", hwX + hwW / 2, hwY + 32);

            // Buttons
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(hwX + 20, hwY + 54, 4.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.beginPath();
            ctx.arc(hwX + hwW - 20, hwY + 54, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Speaker rings (White acoustic emission waves)
            const ringColors = ["rgba(255, 255, 255, 0.9)", "rgba(255, 255, 255, 0.6)", "rgba(255, 255, 255, 0.35)"];
            for (let r = 0; r < 3; r++) {
                ctx.beginPath();
                ctx.arc(hwX + hwW / 2, hwY + 72, 3 + r * 3.5, 0, Math.PI * 2);
                ctx.strokeStyle = ringColors[r];
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 8px 'JetBrains Mono', monospace";
            ctx.fillText("ESP32 SOUND WALLET", hwX + hwW / 2, hwY - 6);
            ctx.restore();

            // 2. RECEIVER HAND POS (Right)
            const pEnd = precomputedPoints[samples];
            const handX = pEnd.normX * width + 8;
            const handY = pEnd.normY * height;

            ctx.save();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2.0;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            ctx.moveTo(handX + 50, handY + 24);
            ctx.lineTo(handX + 34, handY + 15);
            ctx.quadraticCurveTo(handX + 22, handY + 9, handX + 16, handY - 4);
            ctx.quadraticCurveTo(handX + 9, handY - 13, handX + 18, handY - 18);
            ctx.quadraticCurveTo(handX + 24, handY - 14, handX + 26, handY - 4);
            ctx.quadraticCurveTo(handX + 18, handY - 7, handX + 5, handY - 11);
            ctx.quadraticCurveTo(handX - 2, handY - 11, handX + 4, handY - 5);
            ctx.quadraticCurveTo(handX - 5, handY - 3, handX - 9, handY);
            ctx.quadraticCurveTo(handX - 5, handY + 4, handX + 4, handY + 4);
            ctx.quadraticCurveTo(handX - 2, handY + 7, handX + 5, handY + 11);
            ctx.quadraticCurveTo(handX + 15, handY + 15, handX + 32, handY + 20);
            ctx.lineTo(handX + 52, handY + 31);
            ctx.stroke();

            for (let r = 0; r < 3; r++) {
                ctx.beginPath();
                ctx.arc(handX - 9, handY, 5 + r * 3.5, -Math.PI * 0.4, Math.PI * 0.4);
                ctx.strokeStyle = ringColors[r];
                ctx.lineWidth = 1.3;
                ctx.stroke();
            }

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 8px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText("RECEIVER POS // MIC", handX + 26, handY - 24);
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

            // 4. DRAW TRAVELING WAVE PULSES
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

                if (sStart < 0) {
                    drawPulseSlice(samples + sStart, samples);
                    drawPulseSlice(0, sEnd);
                } else if (sEnd > samples) {
                    drawPulseSlice(sStart, samples);
                    drawPulseSlice(0, sEnd - samples);
                } else {
                    drawPulseSlice(sStart, sEnd);
                }
            }
            ctx.restore();

            // 5. DRAW GLOWING TRAVELING PEARL
            const pearlIndex = Math.round(playheadU * samples);
            const pearlPt = precomputedPoints[Math.min(samples, Math.max(0, pearlIndex))];
            if (pearlPt) {
                const px = pearlPt.normX * width;
                const py = pearlPt.normY * height;

                ctx.save();
                ctx.beginPath();
                ctx.arc(px, py, 6.0, 0, Math.PI * 2);
                ctx.fillStyle = "#FFFFFF";
                ctx.shadowColor = "#FFFFFF";
                ctx.shadowBlur = 24;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(px, py, 13, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }

            // 6. DRAW FLOATING NOTES IN GLOWING WHITE
            NOTES.forEach((note) => {
                const sIdx = Math.round(note.t * samples);
                const pt = precomputedPoints[Math.min(samples, Math.max(0, sIdx))];
                if (!pt) return;

                const offset = note.lineOffset * lineSpacing;
                const floatBob = Math.sin(frameCount * 0.018 + note.t * 8) * 2.5;
                const nx = pt.normX * width + pt.nx * offset;
                const ny = pt.normY * height + pt.ny * offset + floatBob;

                const distToPulse = Math.abs(playheadU - note.t);
                const isLit = distToPulse < 0.04 || distToPulse > 0.96;

                ctx.save();
                ctx.font = "bold 15px 'JetBrains Mono', sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                if (isLit) {
                    ctx.shadowColor = "#FFFFFF";
                    ctx.shadowBlur = 18;
                    ctx.fillStyle = "#FFFFFF";
                } else {
                    ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
                    ctx.shadowBlur = 6;
                    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
                }

                ctx.fillText(note.symbol, nx, ny);

                // Frequency badge
                ctx.font = "bold 6.5px 'JetBrains Mono', monospace";
                ctx.fillStyle = isLit ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)";
                ctx.shadowBlur = isLit ? 10 : 0;
                ctx.fillText(note.label, nx, ny + 13);
                ctx.restore();
            });

            animIdRef.current = requestAnimationFrame(render);
        };

        animIdRef.current = requestAnimationFrame(render);

        return () => {
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            window.removeEventListener("resize", handleResize);
        };
    }, [isPlaying, isVisible]);

    return (
        <div ref={containerRef} className={`relative w-full h-full select-none ${className}`}>
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
            />
        </div>
    );
}
