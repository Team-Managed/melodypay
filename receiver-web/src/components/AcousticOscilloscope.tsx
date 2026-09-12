import { useEffect, useRef, useState } from "react";
import { Play, Volume2, Activity, Radio, AlertCircle } from "lucide-react";

interface AcousticOscilloscopeProps {
    height?: number;
    showControls?: boolean;
    activeMessage?: string;
    isReceiving?: boolean;
    isTransmitting?: boolean;
}

export function AcousticOscilloscope({
    height = 160,
    showControls = true,
    activeMessage = "IDLE // AWAITING AUDIO FRAMES",
    isReceiving = false,
    isTransmitting = false,
}: AcousticOscilloscopeProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animIdRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const syntheticPhaseRef = useRef<number>(0);
    const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);
    const [audioActive, setAudioActive] = useState(false);
    const [rmsDb, setRmsDb] = useState<number>(-54);

    // Initialize Web Audio Analyzer or synthetic generator
    useEffect(() => {
        let isMounted = true;

        const initAudio = async () => {
            try {
                const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                if (!AudioContextClass) return;

                const ctx = new AudioContextClass();
                audioCtxRef.current = ctx;

                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.8;
                analyserRef.current = analyser;

                setAudioActive(true);
            } catch {
                setAudioActive(false);
            }
        };

        initAudio();

        return () => {
            isMounted = false;
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => {});
            }
        };
    }, []);

    // Canvas rendering loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let lastTime = performance.now();

        const render = (time: number) => {
            const dt = (time - lastTime) / 1000;
            lastTime = time;
            syntheticPhaseRef.current += dt * 4;

            const width = canvas.width;
            const height = canvas.height;

            // Clear with studio background
            ctx.fillStyle = "#FBFBF9";
            ctx.fillRect(0, 0, width, height);

            // Draw technical drafting grid lines inside oscilloscope
            ctx.strokeStyle = "rgba(17, 17, 19, 0.05)";
            ctx.lineWidth = 1;
            const gridSize = 20;
            for (let x = 0; x < width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Center horizontal datum line
            ctx.strokeStyle = "rgba(0, 136, 255, 0.2)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Gather time-domain data
            const analyser = analyserRef.current;
            const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 256);

            let hasLiveSignal = false;
            if (analyser && audioCtxRef.current?.state === "running") {
                analyser.getByteTimeDomainData(dataArray);
                for (let i = 0; i < dataArray.length; i++) {
                    if (Math.abs(dataArray[i] - 128) > 3) {
                        hasLiveSignal = true;
                        break;
                    }
                }
            }

            // Calculate RMS or generate synthetic acoustic wave when transmitting/receiving/test-playing
            const isActiveState = isReceiving || isTransmitting || isPlayingTestTone;

            // Draw Waveform Beam
            ctx.lineWidth = 2;
            if (isTransmitting) {
                ctx.strokeStyle = "#F59E0B"; // Amber for transmitting
                ctx.shadowColor = "rgba(245, 158, 11, 0.5)";
            } else if (isReceiving) {
                ctx.strokeStyle = "#10B981"; // Emerald for listening/receiving
                ctx.shadowColor = "rgba(16, 185, 129, 0.5)";
            } else if (isPlayingTestTone) {
                ctx.strokeStyle = "#0088FF"; // Cyan for test chirp
                ctx.shadowColor = "rgba(0, 136, 255, 0.6)";
            } else {
                ctx.strokeStyle = "#4B4B52"; // Subtle carbon for idle baseline
                ctx.shadowColor = "transparent";
            }
            ctx.shadowBlur = isActiveState ? 8 : 0;

            ctx.beginPath();
            const sliceWidth = width / dataArray.length;
            let x = 0;

            for (let i = 0; i < dataArray.length; i++) {
                let v = dataArray[i] / 128.0;

                // If in synthetic mode, generate characteristic FSK multi-tone wave
                if (!hasLiveSignal) {
                    if (isActiveState) {
                        const freqMultiplier = isTransmitting ? 12 : 8;
                        const envelope = Math.sin((i / dataArray.length) * Math.PI);
                        const wave1 = Math.sin(i * 0.15 + syntheticPhaseRef.current * freqMultiplier);
                        const wave2 = Math.sin(i * 0.32 + syntheticPhaseRef.current * 18);
                        const jitter = (Math.random() - 0.5) * 0.05;
                        v = 1.0 + (wave1 * 0.35 + wave2 * 0.15 + jitter) * envelope;
                    } else {
                        // Ambient slight electrical noise floor
                        const microNoise = (Math.random() - 0.5) * 0.04;
                        v = 1.0 + microNoise;
                    }
                }

                const y = (v * height) / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }

            ctx.stroke();
            ctx.shadowBlur = 0;

            // Draw Frequency Spectrogram Bars at bottom
            const numBars = 32;
            const barWidth = width / numBars - 2;
            for (let b = 0; b < numBars; b++) {
                let barHeight = 4;
                if (isActiveState) {
                    // Accentuate 1.8 kHz - 2.2 kHz zone (bars 12 to 20)
                    const isFskBin = b >= 12 && b <= 20;
                    const boost = isFskBin ? 2.8 : 0.6;
                    barHeight = Math.sin(b * 0.4 + syntheticPhaseRef.current * 8) * 20 * boost + 12;
                    barHeight = Math.max(3, Math.min(height * 0.45, barHeight));
                } else {
                    barHeight = Math.random() * 5 + 2;
                }

                const barX = b * (barWidth + 2);
                const barY = height - barHeight;

                ctx.fillStyle = b >= 12 && b <= 20 && isActiveState
                    ? "rgba(0, 136, 255, 0.7)"
                    : "rgba(17, 17, 19, 0.12)";
                ctx.fillRect(barX, barY, barWidth, barHeight);
            }

            animIdRef.current = requestAnimationFrame(render);
        };

        animIdRef.current = requestAnimationFrame(render);

        return () => {
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
        };
    }, [isReceiving, isTransmitting, isPlayingTestTone]);

    // Test tone generator: Plays a 1950Hz FSK carrier chirp for 450ms
    const playTestTone = async () => {
        if (isPlayingTestTone) return;
        setIsPlayingTestTone(true);
        setRmsDb(-18);

        try {
            const ctx = audioCtxRef.current || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            if (ctx.state === "suspended") {
                await ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            // FSK frequency sweep simulating ggwave audible fastest packet header
            osc.frequency.setValueAtTime(1875, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(2150, ctx.currentTime + 0.35);

            gain.gain.setValueAtTime(0.001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.4);

            setTimeout(() => {
                setIsPlayingTestTone(false);
                setRmsDb(-52);
            }, 450);
        } catch {
            setTimeout(() => {
                setIsPlayingTestTone(false);
                setRmsDb(-52);
            }, 450);
        }
    };

    return (
        <div className="w-full bg-[#FFFFFF] border border-[#E2E2DA] rounded-lg p-4 shadow-sm font-mono">
            {/* Telemetry Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#ECECE6] text-xs">
                <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-[#F5F5F0] text-[#111113]">
                        <Activity size={14} className={isPlayingTestTone || isReceiving || isTransmitting ? "text-[#0088FF] animate-spin" : "text-[#7A7A85]"} />
                    </span>
                    <div>
                        <span className="font-semibold text-[#111113] block">
                            ACOUSTIC SPECTRUM TELEMETRY
                        </span>
                        <span className="text-[10px] text-[#7A7A85]">
                            BAND: 1875 Hz – 2187 Hz // FSK AUDIBLE FASTEST
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#F5F5F0] rounded border border-[#E2E2DA]">
                        <span className={`w-2 h-2 rounded-full ${
                            isTransmitting ? "bg-[#F59E0B] animate-pulse" :
                            isReceiving ? "bg-[#10B981] animate-pulse" :
                            isPlayingTestTone ? "bg-[#0088FF] animate-pulse" : "bg-[#A1A1AA]"
                        }`} />
                        <span className="text-[#111113] font-medium uppercase text-[10px]">
                            {isTransmitting ? "TRANSMITTING" : isReceiving ? "CAPTURING" : isPlayingTestTone ? "TEST CHIRP" : "STANDBY"}
                        </span>
                    </div>

                    <span className="text-[#7A7A85] hidden sm:inline">
                        RATE: <strong className="text-[#111113]">48.0 kHz</strong>
                    </span>
                    <span className="text-[#7A7A85] hidden sm:inline">
                        NOISE: <strong className="text-[#111113]">{isPlayingTestTone ? "-18 dBFS" : "-52 dBFS"}</strong>
                    </span>
                </div>
            </div>

            {/* Canvas Scope Viewport */}
            <div className="relative mt-3 w-full rounded overflow-hidden border border-[#E2E2DA] bg-[#FBFBF9]">
                <canvas
                    ref={canvasRef}
                    width={720}
                    height={height}
                    className="w-full block"
                    style={{ height: `${height}px` }}
                />

                {/* Overlaid FSK Frequency Markers */}
                <div className="absolute top-2 right-3 pointer-events-none text-[10px] text-[#7A7A85] flex flex-col items-end gap-0.5">
                    <span>FSK.F0 = 1875.0 Hz</span>
                    <span>FSK.F1 = 2031.2 Hz</span>
                    <span>FSK.F2 = 2187.5 Hz</span>
                </div>

                {/* Status Watermark */}
                <div className="absolute bottom-2 left-3 pointer-events-none flex items-center gap-1.5 text-[10px] font-mono text-[#4B4B52] bg-[#FFFFFF]/80 backdrop-blur-sm px-2 py-0.5 rounded border border-[#E2E2DA]">
                    <Radio size={10} className="text-[#0088FF]" />
                    <span>{activeMessage}</span>
                </div>
            </div>

            {/* Controls Bar */}
            {showControls && (
                <div className="mt-3 pt-3 border-t border-[#ECECE6] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-[11px] text-[#7A7A85] flex items-center gap-1.5">
                        <AlertCircle size={13} className="text-[#0088FF]" />
                        <span>Acoustic audio wave data transport via ggwave protocol. No RF, WiFi, or Bluetooth required.</span>
                    </div>

                    <button
                        type="button"
                        onClick={playTestTone}
                        disabled={isPlayingTestTone}
                        className="flex items-center gap-2 bg-[#111113] hover:bg-black text-white px-3 py-1.5 rounded text-xs font-mono transition-all disabled:opacity-50 shadow-sm"
                    >
                        <Volume2 size={13} className={isPlayingTestTone ? "text-[#00E5FF] animate-bounce" : "text-white"} />
                        <span>{isPlayingTestTone ? "Emitting 1950Hz..." : "Test Acoustic Tone (Chirp)"}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
