import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";

interface VibrantSoundBarsProps {
    barCount?: number;
    className?: string;
}

// Exactly the iconic vibrant gradients from the initial prototype
const GRADIENTS = [
    "linear-gradient(180deg, #1848FF 0%, #FF0099 50%, #FFD600 100%)", // Blue -> Pink -> Yellow
    "linear-gradient(180deg, #FF0099 0%, #FFD600 50%, #00FFA3 100%)", // Pink -> Yellow -> Mint
    "linear-gradient(180deg, #FFD600 0%, #00FFA3 50%, #1848FF 100%)", // Yellow -> Mint -> Blue
    "linear-gradient(180deg, #836EF9 0%, #FF0099 50%, #00E5FF 100%)", // Monad Purple -> Magenta -> Cyan
    "linear-gradient(180deg, #00FFA3 0%, #1848FF 50%, #FF0099 100%)", // Mint -> Blue -> Pink
    "linear-gradient(180deg, #2A2A2E 0%, #8E8E93 50%, #E5E5EA 100%)", // Metallic Chrome Bar
];

// Natural wave envelope heights
const ENVELOPE = [
    0.3, 0.48, 0.72, 0.95, 0.68, 0.42, 0.58, 0.88, 1.0, 0.76,
    0.45, 0.62, 0.92, 0.82, 0.52, 0.68, 0.96, 0.78, 0.56, 0.38,
    0.65, 0.85, 0.55, 0.35, 0.52, 0.78, 0.92, 0.7
];

export function VibrantSoundBars({ barCount = 28, className = "" }: VibrantSoundBarsProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Mouse parallax interaction on the sound bars using GSAP
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const ctx = gsap.context(() => {
            const handleMouseMove = (e: MouseEvent) => {
                const { clientX } = e;
                const xOffset = (clientX / window.innerWidth - 0.5) * 45;
                gsap.to(".vibrant-sound-bar", {
                    x: xOffset,
                    duration: 1.4,
                    ease: "power2.out",
                    stagger: { amount: 0.25, from: "center" }
                });
            };

            window.addEventListener("mousemove", handleMouseMove);
            return () => window.removeEventListener("mousemove", handleMouseMove);
        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <div 
            ref={containerRef} 
            className={`absolute inset-0 flex items-center justify-center gap-2 sm:gap-2.5 lg:gap-3.5 px-4 sm:px-8 lg:px-16 overflow-hidden pointer-events-none select-none ${className}`}
        >
            {/* Dark Mode Gradient Overlays to blend gracefully into #050508 */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-[#050508] z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050508] via-transparent to-[#050508] z-10 pointer-events-none" />

            {/* Oscillating Pill Bars */}
            {[...Array(barCount)].map((_, i) => {
                const gradient = GRADIENTS[i % GRADIENTS.length];
                const basePeak = ENVELOPE[i % ENVELOPE.length];
                const minScale = Math.max(0.12, basePeak * 0.22);
                const maxScale = Math.min(1.0, basePeak * 1.05);

                return (
                    <motion.div
                        key={i}
                        className="vibrant-sound-bar flex-1 max-w-[20px] sm:max-w-[26px] lg:max-w-[34px] rounded-full"
                        style={{
                            background: gradient,
                            height: "65%",
                            transformOrigin: "center",
                            boxShadow: "0 0 24px rgba(255, 0, 153, 0.22), 0 0 35px rgba(24, 72, 255, 0.18)",
                        }}
                        initial={{ scaleY: minScale, opacity: 0.6 }}
                        animate={{
                            scaleY: [minScale, maxScale, minScale],
                            opacity: [0.65, 0.95, 0.65],
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: 0.75 + (i % 6) * 0.18,
                            delay: (i * 0.09) % 0.8,
                            ease: "easeInOut",
                        }}
                    />
                );
            })}
        </div>
    );
}
