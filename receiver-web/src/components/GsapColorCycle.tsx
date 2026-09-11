import React, { useEffect, useRef } from "react";
import gsap from "gsap";

interface Props {
  children: React.ReactNode;
  colors: string[];
}

export function GsapColorCycle({ children, colors }: Props) {
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!elRef.current || colors.length === 0) return;
      
      const tl = gsap.timeline({ repeat: -1 });
      
      // Initial color setup
      gsap.set(elRef.current, { color: colors[0] });

      // Create a smooth tween cycle through the colors array
      colors.forEach((color, i) => {
        if (i === 0) return; // Skip first as it's the start color
        tl.to(elRef.current, { color: color, duration: 1.5, ease: "sine.inOut" });
      });
      
      // Tween back to the first color to make it seamless
      tl.to(elRef.current, { color: colors[0], duration: 1.5, ease: "sine.inOut" });

    }, elRef);

    return () => ctx.revert();
  }, [colors]);

  return (
    <span ref={elRef} className="font-semibold inline-block">
      {children}
    </span>
  );
}
