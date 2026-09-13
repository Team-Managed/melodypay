import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX, Sparkles, Play, Pause } from "lucide-react";

interface NotePoint {
    t: number; // 0 to 1 position along curve
    lineIndex: number; // which staff line (-2 to 2)
    symbol: string;
    freq: number; // acoustic frequency in Hz (1875 - 2200 Hz ggwave band)
    label: string;
}

export function MelodyRibbonWave() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animIdRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const [isMuted, setIsMuted] = useState<boolean>(true);
    const lastNotePlayedRef = useRef<number>(-1);
    const playheadPosRef = useRef<number>(0);
    const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

    // FSK & Musical pentatonic frequencies in MelodyPay's 1.8kHz - 2.2kHz band
    const NOTES: NotePoint[] = [
        { t: 0.12, lineIndex: 1, symbol: "♪", freq: 1875, label: "F0: 1875Hz" },
        { t: 0.22, lineIndex: -1, symbol: "♫", freq: 1950, label: "MAGIC: 0x4D" },
        { t: 0.35, lineIndex: 2, symbol: "♬", freq: 2031, label: "GASLESS" },
        { t: 0.48, lineIndex: 0, symbol: "♪", freq: 2100, label: "USDC: 6dec" },
        { t: 0.62, lineIndex: -2, symbol: "♫", freq: 2187, label: "F1: 2187Hz" },
        { t: 0.74, lineIndex: 1, symbol: "♩", freq: 1980, label: "ARC: 5042002" },
        { t: 0.88, lineIndex: -1, symbol: "♪", freq: 2080, label: "CRC-8 OK" },
    ];

    // Sound chime synthesizer: completely silent per user requirement
    const playChime = useCallback((_freq: number) => {
        return;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
        let height = (canvas.height = canvas.parentElement?.clientHeight || 650);

        const handleResize = () => {
            if (!canvas || !canvas.parentElement) return;
            width = canvas.width = canvas.parentElement.clientWidth;
            height = canvas.height = canvas.parentElement.clientHeight;
        };
        window.addEventListener("resize", handleResize);

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                active: true,
            };
        };
        const handleMouseLeave = () => {
            mouseRef.current.active = false;
        };

        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseleave", handleMouseLeave);

        // Define calligraphic master spline points like the cursive ribbon in user's image
        // Flowing script: Ingress -> Loop M -> Dip -> Loop A -> Ascender -> Descender Y -> Egress
        const getMasterPoint = (u: number, time: number): { x: number; y: number } => {
            // u is 0 to 1 along the curve
            const startX = -60;
            const endX = width + 60;
            const x = startX + u * (endX - startX);

            const midY = height * 0.48;
            const scaleY = height * 0.28;

            // Harmonically composite cursive loops: "m - a - y" calligraphy motion
            // Loop 1 (M first crest)
            const loop1 = Math.sin(u * Math.PI * 2.8) * Math.exp(-Math.pow((u - 0.24) * 5, 2)) * 1.35;
            // Loop 2 (M second crest)
            const loop2 = Math.sin(u * Math.PI * 3.4) * Math.exp(-Math.pow((u - 0.38) * 5.5, 2)) * 1.25;
            // Loop 3 (A high oval)
            const loop3 = Math.sin(u * Math.PI * 4.2) * Math.exp(-Math.pow((u - 0.55) * 6, 2)) * 1.6;
            // Loop 4 (Y deep descender loop like image)
            const loop4 = -Math.sin(u * Math.PI * 3.6) * Math.exp(-Math.pow((u - 0.76) * 5, 2)) * 2.0;

            // Ambient gentle sine wave flowing in the background
            const baselineWave = Math.sin(u * Math.PI * 3 + time * 0.8) * 0.18;

            // Mouse elastic pull
            let mousePull = 0;
            if (mouseRef.current.active) {
                const distToMouse = Math.hypot(x - mouseRef.current.x, midY - mouseRef.current.y);
                if (distToMouse < 180) {
                    mousePull = (1 - distToMouse / 180) * ((mouseRef.current.y - midY) * 0.4);
                }
            }

            const y = midY - (loop1 + loop2 + loop3 + loop4 + baselineWave) * scaleY + mousePull;
            return { x, y };
        };

        // Numerical derivative to obtain normal vector at point u
        const getNormal = (u: number, time: number): { nx: number; ny: number } => {
            const delta = 0.002;
            const p0 = getMasterPoint(Math.max(0, u - delta), time);
            const p1 = getMasterPoint(Math.min(1, u + delta), time);
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const len = Math.hypot(dx, dy) || 1;
            // Normal is perpendicular (-dy, dx)
            return { nx: -dy / len, ny: dx / len };
        };

        let time = 0;
        const numStaffLines = 6; // 6 parallel lines like the musical stave ribbon in image
        const lineSpacing = 6.5; // pixel spacing between lines

        const render = () => {
            if (isPlaying) {
                time += 0.015;
                playheadPosRef.current = (playheadPosRef.current + 0.0022) % 1.0;
            }

            ctx.clearRect(0, 0, width, height);

            const playheadU = playheadPosRef.current;

            // Check if playhead hit a note to trigger chime
            for (let n = 0; n < NOTES.length; n++) {
                const note = NOTES[n];
                if (Math.abs(playheadU - note.t) < 0.003 && lastNotePlayedRef.current !== n) {
                    lastNotePlayedRef.current = n;
                    playChime(note.freq);
                    break;
                }
            }
            if (NOTES.every(n => Math.abs(playheadU - n.t) >= 0.005)) {
                lastNotePlayedRef.current = -1;
            }

            const samples = 360;
            const stepU = 1.0 / samples;

            // Precompute master points & normals
            const pointsAndNormals: { x: number; y: number; nx: number; ny: number }[] = [];
            for (let s = 0; s <= samples; s++) {
                const u = s * stepU;
                const p = getMasterPoint(u, time);
                const n = getNormal(u, time);
                pointsAndNormals.push({ x: p.x, y: p.y, nx: n.nx, ny: n.ny });
            }

            // Draw parallel staff lines
            for (let l = 0; l < numStaffLines; l++) {
                const offset = (l - (numStaffLines - 1) / 2) * lineSpacing;

                for (let s = 0; s < samples; s++) {
                    const u = s * stepU;
                    const pn0 = pointsAndNormals[s];
                    const pn1 = pointsAndNormals[s + 1];

                    const x0 = pn0.x + pn0.nx * offset;
                    const y0 = pn0.y + pn0.ny * offset;
                    const x1 = pn1.x + pn1.nx * offset;
                    const y1 = pn1.y + pn1.ny * offset;

                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);

                    // Transmission pulse zone:
                    // Around playhead, lines are filled with electric blue and acoustic yellow
                    const distToPlayhead = Math.abs(u - playheadU);
                    const wrapDist = Math.min(distToPlayhead, 1 - distToPlayhead);

                    // Dual colored pulses: Leading edge is Blue (#0088FF), trailing edge is Yellow (#FFD600)
                    if (wrapDist < 0.08) {
                        const intensity = 1 - wrapDist / 0.08;
                        if (l % 2 === 0) {
                            // Electric Cyan-Blue
                            ctx.strokeStyle = `rgba(0, 136, 255, ${0.4 + intensity * 0.6})`;
                            ctx.lineWidth = 2.4;
                            ctx.shadowColor = "rgba(0, 136, 255, 0.6)";
                            ctx.shadowBlur = 6 * intensity;
                        } else {
                            // Acoustic Warm Yellow
                            ctx.strokeStyle = `rgba(245, 180, 0, ${0.4 + intensity * 0.6})`;
                            ctx.lineWidth = 2.4;
                            ctx.shadowColor = "rgba(245, 180, 0, 0.6)";
                            ctx.shadowBlur = 6 * intensity;
                        }
                    } else {
                        // Base fine technical grey lines like the image
                        ctx.strokeStyle = "rgba(26, 26, 30, 0.22)";
                        ctx.lineWidth = 1.1;
                        ctx.shadowBlur = 0;
                    }

                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }

            // Draw musical notes & technical FSK packet markers on the ribbon
            for (let i = 0; i < NOTES.length; i++) {
                const note = NOTES[i];
                const sampleIndex = Math.min(samples, Math.floor(note.t * samples));
                const pn = pointsAndNormals[sampleIndex];
                const offset = note.lineIndex * lineSpacing;
                const noteX = pn.x + pn.nx * offset;
                const noteY = pn.y + pn.ny * offset;

                const isNearPlayhead = Math.abs(playheadU - note.t) < 0.06;

                // Note Head / Symbol
                ctx.save();
                ctx.font = isNearPlayhead ? "bold 16px sans-serif" : "13px sans-serif";
                ctx.fillStyle = isNearPlayhead ? "#0088FF" : "#111113";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(note.symbol, noteX, noteY);

                // Small technical frequency tag
                ctx.font = "9px 'JetBrains Mono', monospace";
                ctx.fillStyle = isNearPlayhead ? "#F59E0B" : "rgba(120, 120, 130, 0.7)";
                ctx.fillText(note.label, noteX, noteY + (note.lineIndex >= 0 ? 14 : -14));

                ctx.restore();
            }

            // Draw Playhead / Transmission Cursor across the stave (like the pink/blue marker in image)
            const playheadIndex = Math.min(samples, Math.floor(playheadU * samples));
            const curPn = pointsAndNormals[playheadIndex];
            const halfHeight = (numStaffLines * lineSpacing) * 0.85;

            const cursorX0 = curPn.x + curPn.nx * (-halfHeight);
            const cursorY0 = curPn.y + curPn.ny * (-halfHeight);
            const cursorX1 = curPn.x + curPn.nx * halfHeight;
            const cursorY1 = curPn.y + curPn.ny * halfHeight;

            // Yellow/Pink playhead bar
            ctx.beginPath();
            ctx.moveTo(cursorX0, cursorY0);
            ctx.lineTo(cursorX1, cursorY1);
            ctx.strokeStyle = "#FF3366"; // Vivid pink/red vertical playhead bar like screenshot
            ctx.lineWidth = 3.5;
            ctx.shadowColor = "rgba(255, 51, 102, 0.8)";
            ctx.shadowBlur = 8;
            ctx.stroke();

            // Offset secondary blue playhead bar immediately behind it
            const trailIndex = Math.max(0, playheadIndex - 3);
            const trailPn = pointsAndNormals[trailIndex];
            ctx.beginPath();
            ctx.moveTo(trailPn.x + trailPn.nx * (-halfHeight), trailPn.y + trailPn.ny * (-halfHeight));
            ctx.lineTo(trailPn.x + trailPn.nx * halfHeight, trailPn.y + trailPn.ny * halfHeight);
            ctx.strokeStyle = "#0088FF"; // Electric blue trailing bar
            ctx.lineWidth = 3.0;
            ctx.shadowColor = "rgba(0, 136, 255, 0.8)";
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;

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
    }, [isPlaying, isMuted, playChime]);

    const togglePlaying = () => {
        setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
            <canvas
                ref={canvasRef}
                className="w-full h-full pointer-events-auto block"
            />

            {/* Subtle Gradient Overlays for Light Theme Polish */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#FBFBF9]/60 via-transparent to-[#FBFBF9] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#FBFBF9]/70 via-transparent to-[#FBFBF9]/70 pointer-events-none" />

            {/* "Stop Playing / Start Playing" Control pill like the screenshot */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-3 bg-[#FFFFFF]/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-[#E2E2DA] shadow-xs text-xs font-mono">
                <button
                    type="button"
                    onClick={togglePlaying}
                    className="flex items-center gap-1.5 text-[#111113] hover:text-[#0088FF] transition-colors font-medium"
                >
                    {isPlaying ? (
                        <>
                            <Pause size={12} className="text-[#0088FF]" />
                            <span>stop playing</span>
                        </>
                    ) : (
                        <>
                            <Play size={12} className="text-[#10B981]" />
                            <span>start playing</span>
                        </>
                    )}
                </button>

                <span className="text-[#ECECE6]">|</span>

                <button
                    type="button"
                    onClick={toggleMute}
                    className="flex items-center gap-1 text-[#7A7A85] hover:text-[#111113] transition-colors"
                    title={isMuted ? "Unmute Chimes" : "Mute Chimes"}
                >
                    {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} className="text-[#0088FF]" />}
                    <span className="text-[10px]">{isMuted ? "muted" : "chimes on"}</span>
                </button>

                <span className="text-[#ECECE6]">|</span>

                <div className="flex items-center gap-1.5 text-[10px] text-[#7A7A85]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0088FF] shadow-[0_0_5px_rgba(0,136,255,0.8)]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shadow-[0_0_5px_rgba(245,158,11,0.8)]" />
                    <span>Acoustic Stave</span>
                </div>
            </div>
        </div>
    );
}
