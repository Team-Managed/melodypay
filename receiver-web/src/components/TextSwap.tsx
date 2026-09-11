import React, { useState, useEffect, useRef } from 'react';

interface TextSwapProps {
  texts: string[];
  intervalMs?: number;
}

export function TextSwap({ texts, intervalMs = 3000 }: TextSwapProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (texts.length <= 1) return;

    const intervalId = setInterval(() => {
      const span = spanRef.current;
      if (!span) return;

      // 1. Add `.is-exit` -> old text slides up + blurs + fades
      span.classList.add('is-exit');

      setTimeout(() => {
        // 2. Change textContent, then add `.is-enter-start`
        setCurrentIndex((prev) => (prev + 1) % texts.length);
        span.classList.remove('is-exit');
        span.classList.add('is-enter-start');

        // 3. Force reflow
        void span.offsetWidth;

        // 4. Remove `.is-enter-start` so the new text animates back to 0
        span.classList.remove('is-enter-start');
      }, 150); // Matches --text-swap-dur
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [texts, intervalMs]);

  return (
    <span ref={spanRef} className="t-text-swap inline-block min-w-[3em]">
      {texts[currentIndex]}
    </span>
  );
}
