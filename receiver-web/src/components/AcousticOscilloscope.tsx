import { useEffect, useRef, useState } from "react";
import { Mic, Square, Activity, Radio, AlertCircle, CheckCircle2 } from "lucide-react";
import { decode, initGGWave } from "../core/ggwave";
import { subscribeAudioStream } from "../core/listener";

interface AcousticOscilloscopeProps {
    height?: number;
    showControls?: boolean;
    activeMessage?: string;
    isReceiving?: boolean;
    isTransmitting?: boolean;
    darkMode?: boolean;
    bgImage?: string;
    transparentBg?: boolean;
}

export function AcousticOscilloscope({
    height = 160,
    showControls = true,
    activeMessage = "IDLE // AWAITING AUDIO FRAMES",
    isReceiving = false,
    isTransmitting = false,
    darkMode = false,
    bgImage,
    transparentBg = false,
}: AcousticOscilloscopeProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animIdRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const preampGainRef = useRef<GainNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    const [isListeningTest, setIsListeningTest] = useState(false);
    const [micError, setMicError] = useState<string | null>(null);
    const [decodedPayload, setDecodedPayload] = useState<string | null>(null);
    const [rmsDb, setRmsDb] = useState<number>(-54);

    // Initialize or retrieve Web Audio Context and Analyser safely (supports any native sample rate)
    const getOrCreateAudio = (): { ctx: AudioContext; analyser: AnalyserNode } | null => {
        try {
            const AudioContextClass =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) return null;

            if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
                let ctx: AudioContext;
                try {
                    ctx = new AudioContextClass({ sampleRate: 48000 });
                } catch {
                    ctx = new AudioContextClass();
                }
                audioCtxRef.current = ctx;

                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.6;
                analyserRef.current = analyser;
            }

            return { ctx: audioCtxRef.current, analyser: analyserRef.current! };
        } catch (e: any) {
            console.error("Failed to initialize AudioContext", e);
            return null;
        }
    };

    // Automatically synchronize with the payment receiver's active microphone stream
    useEffect(() => {
        const unsubscribe = subscribeAudioStream((source, ctx) => {
            audioCtxRef.current = ctx;
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }
            const analyser = analyserRef.current;
            if (analyser) {
                try {
                    const preamp = ctx.createGain();
                    preamp.gain.value = 5.0; // 5x preamplification for high-amplitude visual response
                    source.connect(preamp);
                    preamp.connect(analyser);
                } catch {}
            }
        });

        return unsubscribe;
    }, []);

    // Stop manual microphone listening test
    const stopListening = () => {
        if (processorRef.current) {
            try { processorRef.current.disconnect(); } catch {}
            processorRef.current = null;
        }

        if (preampGainRef.current) {
            try { preampGainRef.current.disconnect(); } catch {}
            preampGainRef.current = null;
        }

        if (micSourceRef.current) {
            try { micSourceRef.current.disconnect(); } catch {}
            micSourceRef.current = null;
        }

        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
        }

        setIsListeningTest(false);
    };

    // Start manual microphone listening test
    const startListening = async () => {
        setMicError(null);
        const audio = getOrCreateAudio();
        if (!audio) {
            setMicError("Web Audio API is not supported on this browser.");
            return;
        }
        const { ctx, analyser } = audio;

        if (ctx.state === "suspended") {
            await ctx.resume().catch(() => {});
        }

        stopListening();

        try {
            await initGGWave(ctx.sampleRate).catch(() => {});

            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            micStreamRef.current = stream;
            const source = ctx.createMediaStreamSource(stream);
            micSourceRef.current = source;

            // Preamp Gain Node (amplifies quiet acoustic microphone input 5.0x into the visualizer)
            const preamp = ctx.createGain();
            preamp.gain.value = 5.0;
            preampGainRef.current = preamp;

            source.connect(preamp);
            preamp.connect(analyser);

            // Use 1024 buffer size matching ggwave native frames, and connect preamplified signal for high-sensitivity decoding
            const processor = ctx.createScriptProcessor(1024, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (event) => {
                const output = event.outputBuffer.getChannelData(0);
                output.fill(0);

                const samples = event.inputBuffer.getChannelData(0);
                try {
                    const result = decode(new Float32Array(samples));
                    if (result && result.trim().length > 0) {
                        console.log("[AcousticOscilloscope] Decoded audio frame:", result.trim());
                        setDecodedPayload(result.trim());
                    }
                } catch (e) {
                    console.error("[AcousticOscilloscope] Decode error:", e);
                }
            };

            preamp.connect(processor);
            processor.connect(ctx.destination);

            setIsListeningTest(true);
        } catch (err: any) {
            console.error("Microphone capture failed:", err);
            stopListening();
            if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
                setMicError("Microphone permission blocked. Please click the camera/mic icon in your browser address bar to allow access.");
            } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
                setMicError("No microphone hardware detected on this device.");
            } else {
                setMicError(`Microphone error: ${err?.message || "Could not open audio input"}`);
            }
        }
    };

    const handleToggleListening = () => {
        if (isListeningTest) {
            stopListening();
        } else {
            startListening();
        }
    };

    // Clean up audio streams and animation on unmount
    useEffect(() => {
        getOrCreateAudio();

        return () => {
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            stopListening();
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => {});
            }
        };
    }, []);

    // Canvas rendering loop — reads physical Web Audio Analyser data directly with visual gain
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;

            // Clear background (translucent / transparent if specified)
            if (transparentBg || !!bgImage) {
                ctx.clearRect(0, 0, width, height);
            } else {
                ctx.fillStyle = darkMode ? "#07170E" : "#FBFBF9";
                ctx.fillRect(0, 0, width, height);
            }

            // Draw technical drafting grid lines (Pure White)
            ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.22)" : "rgba(17, 17, 19, 0.05)";
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

            // Center horizontal datum line (Pure White Dashed)
            ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.45)" : "rgba(0, 136, 255, 0.2)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Gather physical audio data from Web Audio Analyser
            const analyser = analyserRef.current;
            const bufferLen = analyser ? analyser.frequencyBinCount : 256;
            const dataArray = new Uint8Array(bufferLen);
            const freqArray = new Uint8Array(bufferLen);

            let hasLiveAudio = false;

            if (analyser) {
                analyser.getByteTimeDomainData(dataArray);
                analyser.getByteFrequencyData(freqArray);

                for (let i = 0; i < dataArray.length; i++) {
                    if (Math.abs(dataArray[i] - 128) > 0) {
                        hasLiveAudio = true;
                        break;
                    }
                }
            }

            // Compute real RMS (dBFS) from live audio buffer
            if (hasLiveAudio) {
                let sumSquares = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const norm = (dataArray[i] - 128) / 128;
                    sumSquares += norm * norm;
                }
                const rms = Math.sqrt(sumSquares / dataArray.length);
                const db = rms > 0.0001 ? Math.round(20 * Math.log10(rms)) : -60;
                setRmsDb((prev) => Math.round(prev * 0.7 + db * 0.3));
            } else {
                setRmsDb((prev) => (prev > -54 ? prev - 1 : -54));
            }

            const isActiveState = isReceiving || isTransmitting || isListeningTest || hasLiveAudio;

            // Draw Real Waveform Beam (Pure White Glow)
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = darkMode ? "#FFFFFF" : "#111113";
            ctx.shadowColor = darkMode ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 136, 255, 0.5)";
            ctx.shadowBlur = isActiveState ? 10 : 2;

            ctx.beginPath();
            const sliceWidth = width / dataArray.length;
            let x = 0;

            for (let i = 0; i < dataArray.length; i++) {
                let v = 1.0;
                if (hasLiveAudio || isListeningTest || isReceiving) {
                    // Physical time-domain audio samples amplified 5.0x for high-contrast visual motion
                    const rawNorm = (dataArray[i] - 128) / 128.0;
                    const amplified = rawNorm * 5.0;
                    const clamped = Math.max(-0.95, Math.min(0.95, amplified));
                    v = 1.0 + clamped;
                } else {
                    // Subtle ambient electronic baseline noise when completely quiet
                    v = 1.0 + (Math.random() - 0.5) * 0.015;
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

            // Draw Frequency Spectrogram Bars at bottom from real FFT
            const numBars = 32;
            const barWidth = width / numBars - 2;
            for (let b = 0; b < numBars; b++) {
                let barHeight = 2;
                if (hasLiveAudio || isListeningTest || isReceiving) {
                    // Sample corresponding FFT bins for this bar (spanning 0 Hz to ~3200 Hz)
                    const binIndex = Math.min(Math.floor(b * 1.3), freqArray.length - 1);
                    const binVal = freqArray[binIndex] || 0;
                    const boostedVal = Math.min(255, binVal * 2.4);
                    barHeight = Math.max(3, (boostedVal / 255) * (height * 0.48));
                } else {
                    barHeight = Math.random() * 2 + 1;
                }

                const barX = b * (barWidth + 2);
                const barY = height - barHeight;

                const isFskBin = b >= 12 && b <= 20;
                const isLit = isFskBin && hasLiveAudio;
                ctx.fillStyle = isLit
                    ? (darkMode ? "rgba(255, 255, 255, 0.95)" : "rgba(0, 136, 255, 0.85)")
                    : (darkMode ? "rgba(255, 255, 255, 0.35)" : "rgba(17, 17, 19, 0.15)");
                ctx.fillRect(barX, barY, barWidth, barHeight);
            }

            animIdRef.current = requestAnimationFrame(render);
        };

        animIdRef.current = requestAnimationFrame(render);

        return () => {
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
        };
    }, [isReceiving, isTransmitting, isListeningTest, darkMode, bgImage, transparentBg]);

    return (
        <div className={`w-full font-mono transition-all relative overflow-hidden ${
            transparentBg
                ? "bg-transparent border-0 p-0 shadow-none text-white"
                : darkMode 
                ? "bg-black/20 backdrop-blur-md border border-white/25 p-5 sm:p-7 shadow-2xl text-white rounded-3xl" 
                : "bg-[#FFFFFF] border border-[#E2E2DA] rounded-lg p-4 shadow-sm text-[#111113]"
        }`}>
            {/* Optional inner background image only if explicitly supplied and not inherited */}
            {bgImage && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                    <img
                        src={bgImage}
                        alt="Oscilloscope Background"
                        className="w-full h-full object-cover object-center select-none"
                    />
                    <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                </div>
            )}

            {/* Telemetry Header */}
            <div className={`relative z-10 flex flex-wrap items-center justify-between gap-3 pb-3 text-xs ${
                darkMode ? "border-b border-white/20" : "border-b border-[#ECECE6]"
            }`}>
                <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg ${darkMode ? "bg-white/10 text-white border border-white/20" : "bg-[#F5F5F0] text-[#111113]"}`}>
                        <Activity size={14} className={isListeningTest || isReceiving || isTransmitting ? "text-white animate-spin" : "text-white"} />
                    </span>
                    <div>
                        <span className={`font-semibold block ${darkMode ? "text-white" : "text-[#111113]"}`}>
                            ACOUSTIC SPECTRUM TELEMETRY
                        </span>
                        <span className={`text-[10px] ${darkMode ? "text-white/80" : "text-[#7A7A85]"}`}>
                            BAND: 1875 Hz – 2187 Hz // FSK AUDIBLE FASTEST
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                        darkMode ? "bg-white/10 border-white/25 text-white" : "bg-[#F5F5F0] border-[#E2E2DA] text-[#111113]"
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${
                            isTransmitting ? "bg-amber-400 animate-pulse" :
                            isListeningTest || isReceiving ? "bg-emerald-400 animate-pulse" : "bg-white/60"
                        }`} />
                        <span className="font-medium uppercase text-[10px] text-white">
                            {isTransmitting ? "TRANSMITTING" : 
                             isListeningTest || isReceiving ? "RECEIVER LISTENING" : "STANDBY"}
                        </span>
                    </div>

                    <span className={darkMode ? "text-white/80 hidden sm:inline" : "text-[#7A7A85] hidden sm:inline"}>
                        RATE: <strong className="text-white">{audioCtxRef.current ? `${(audioCtxRef.current.sampleRate / 1000).toFixed(1)} kHz` : "48.0 kHz"}</strong>
                    </span>
                    <span className={darkMode ? "text-white/80 hidden sm:inline" : "text-[#7A7A85] hidden sm:inline"}>
                        NOISE: <strong className="text-white">{rmsDb} dBFS</strong>
                    </span>
                </div>
            </div>

            {/* Canvas Scope Viewport */}
            <div className={`relative z-10 mt-3.5 w-full rounded-2xl overflow-hidden border shadow-inner ${
                darkMode ? "border-white/25 bg-black/10 backdrop-blur-[2px]" : "border-[#E2E2DA] bg-[#FBFBF9]"
            }`}>
                <canvas
                    ref={canvasRef}
                    width={720}
                    height={height}
                    className="w-full block relative z-10"
                    style={{ height: `${height}px` }}
                />

                {/* Overlaid FSK Frequency Markers (Pure White) */}
                <div className={`absolute top-2.5 right-3 pointer-events-none text-[10px] flex flex-col items-end gap-0.5 ${
                    darkMode ? "text-white font-mono font-medium drop-shadow-md" : "text-[#7A7A85]"
                }`}>
                    <span>FSK.F0 = 1875.0 Hz</span>
                    <span>FSK.F1 = 2031.2 Hz</span>
                    <span>FSK.F2 = 2187.5 Hz</span>
                </div>

                {/* Status Watermark (Pure White) */}
                <div className={`absolute bottom-2.5 left-3 pointer-events-none flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border ${
                    darkMode ? "bg-black/50 backdrop-blur-md border-white/25 text-white" : "bg-[#FFFFFF]/80 backdrop-blur-sm border-[#E2E2DA] text-[#4B4B52]"
                }`}>
                    {decodedPayload ? (
                        <>
                            <CheckCircle2 size={10} className="text-emerald-400" />
                            <span className="text-emerald-300 font-semibold">DECODED: {decodedPayload}</span>
                        </>
                    ) : (
                        <>
                            <Radio size={10} className="text-white" />
                            <span>
                                {isListeningTest 
                                    ? "RECEIVER ACTIVE // LISTENING VIA MICROPHONE (5.0x PREAMP)" 
                                    : activeMessage}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Error Notification if mic is blocked */}
            {micError && (
                <div className="relative z-10 mt-2 p-2.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-400 shrink-0" />
                    <span>{micError}</span>
                </div>
            )}

            {/* Controls Bar */}
            {showControls && (
                <div className={`relative z-10 mt-3 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs ${
                    darkMode ? "border-t border-white/20" : "border-t border-[#ECECE6]"
                }`}>
                    <div className={`text-[11px] flex items-center gap-1.5 ${darkMode ? "text-white/90" : "text-[#7A7A85]"}`}>
                        <AlertCircle size={13} className="text-white shrink-0" />
                        <span>Acoustic receiver demodulation via ggwave protocol. Real-time microphone capture.</span>
                    </div>

                    <div className="flex items-center gap-2">

                        {/* Test Receiver (Start / Stop Listening) Button */}
                        <button
                            type="button"
                            onClick={handleToggleListening}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all shadow-sm cursor-pointer ${
                                isListeningTest
                                    ? "bg-red-500/30 hover:bg-red-500/40 border border-red-400/70 text-red-100 animate-pulse"
                                    : darkMode 
                                    ? "bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200" 
                                    : "bg-[#0E281A] hover:bg-[#1A3D29] text-white"
                            }`}
                            title={isListeningTest ? "Click to stop listening" : "Activate microphone to test receiving and decoding incoming acoustic sounds"}
                        >
                            {isListeningTest ? (
                                <>
                                    <Square size={13} className="fill-current text-red-300" />
                                    <span>Stop Listening</span>
                                </>
                            ) : (
                                <>
                                    <Mic size={13} className="text-emerald-300" />
                                    <span>Test Receiver (Start Listening)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
