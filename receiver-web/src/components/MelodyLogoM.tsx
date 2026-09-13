export interface MelodyLogoMProps {
    size?: number; // Height in px, default 20
    className?: string;
}

/**
 * MelodyPay Official Brand Mark: Fanned Diagonal Payment Card Stack
 * - Two fanned payment cards arranged diagonally
 * - Back Card: Tilted at -24°, offset up-left, creating an open card spread
 * - Front Card: Tilted at -10°, positioned in the foreground
 * - Front card features:
 *   - EMV acoustic contact chip with cross grid lines
 *   - Contactless acoustic sound wave ripples )))
 *   - Bold italic "MP" payment network brandmark in the bottom-right (Visa-style)
 * - 100% static, crisp vector SVG (zero runtime timers, zero audio)
 */
export function MelodyLogoM({ size = 20, className = "" }: MelodyLogoMProps) {
    // Fanned card stack viewBox: 38 wide by 28 high
    const viewBoxWidth = 38;
    const viewBoxHeight = 28;

    // Aspect ratio: width is (38 / 28) * size
    const calculatedWidth = Math.round((viewBoxWidth / viewBoxHeight) * size);

    return (
        <div 
            className={`inline-flex items-center justify-center shrink-0 select-none group/melody-card ${className}`}
            style={{ width: calculatedWidth, height: size }}
            title="MelodyPay Card Stack"
        >
            <svg
                width={calculatedWidth}
                height={size}
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible"
            >
                {/* ========================================================
                    1. BACK CARD (Tilted at -24°, fanned open behind)
                   ======================================================== */}
                <g transform="translate(16.5, 13.5) rotate(-24)">
                    {/* Card Body */}
                    <rect
                        x="-13"
                        y="-8.25"
                        width="26"
                        height="16.5"
                        rx="2.2"
                        fill="#131317"
                        stroke="#FFFFFF"
                        strokeWidth="1.1"
                        opacity="0.65"
                        className="group-hover/melody-card:opacity-85 transition-opacity"
                    />
                    {/* Magnetic Stripe Accent near top */}
                    <line
                        x1="-13"
                        y1="-4.2"
                        x2="13"
                        y2="-4.2"
                        stroke="#FFFFFF"
                        strokeWidth="1.1"
                        opacity="0.25"
                    />
                </g>

                {/* ========================================================
                    2. FRONT CARD (Tilted at -10°, foreground payment card)
                   ======================================================== */}
                <g transform="translate(20, 15.5) rotate(-10)">
                    {/* Front Card Body */}
                    <rect
                        x="-13"
                        y="-8.25"
                        width="26"
                        height="16.5"
                        rx="2.2"
                        fill="#16161A"
                        stroke="#FFFFFF"
                        strokeWidth="1.25"
                        className="group-hover/melody-card:stroke-white transition-colors"
                    />

                    {/* EMV Acoustic Chip (Top-left) */}
                    <rect
                        x="-10.5"
                        y="-6"
                        width="5.2"
                        height="4"
                        rx="0.9"
                        fill="#24242B"
                        stroke="#FFFFFF"
                        strokeWidth="0.75"
                    />
                    {/* Chip Internal Contact Grid */}
                    <line
                        x1="-10.5"
                        y1="-4"
                        x2="-5.3"
                        y2="-4"
                        stroke="#FFFFFF"
                        strokeWidth="0.45"
                        opacity="0.75"
                    />
                    <line
                        x1="-7.9"
                        y1="-6"
                        x2="-7.9"
                        y2="-2"
                        stroke="#FFFFFF"
                        strokeWidth="0.45"
                        opacity="0.75"
                    />

                    {/* Contactless Acoustic Sound Waves ))) beside chip */}
                    <path
                        d="M -3.8 -5.2 C -2.8 -4.4, -2.8 -3.1, -3.8 -2.3"
                        stroke="#FFFFFF"
                        strokeWidth="0.75"
                        strokeLinecap="round"
                        className="opacity-60"
                    />
                    <path
                        d="M -2.2 -6.0 C -0.8 -4.8, -0.8 -2.7, -2.2 -1.5"
                        stroke="#FFFFFF"
                        strokeWidth="0.75"
                        strokeLinecap="round"
                        className="opacity-85"
                    />

                    {/* Visa-Style "MP" Brandmark (Bottom-right) */}
                    <text
                        x="6.2"
                        y="5.4"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="5.8"
                        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                        fontWeight="900"
                        fontStyle="italic"
                        letterSpacing="-0.5px"
                        className="group-hover/melody-card:fill-white"
                    >
                        MP
                    </text>
                </g>
            </svg>
        </div>
    );
}
