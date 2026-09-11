import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface CopyProps {
  children: React.ReactNode | React.ReactNode[];
  animateOnScroll?: boolean;
  delay?: number;
  blockColor?: string;
  stagger?: number;
  duration?: number;
}

export const Copy = ({
  children,
  animateOnScroll = true,
  delay = 0,
  blockColor = "#1C1C1E",
  stagger = 0.2,
  duration = 0.3,
}: CopyProps) => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });

  const blockVariants = {
    initial: { scaleX: 0, originX: 0 },
    animate: (i: number) => ({
      scaleX: [0, 1, 1, 0],
      originX: [0, 0, 1, 1],
      transition: {
        duration: duration * 2,
        times: [0, 0.45, 0.55, 1],
        ease: "easeOut" as const,
        delay: delay + i * stagger,
      },
    }),
  };

  const textVariants = {
    initial: { opacity: 0 },
    animate: (i: number) => ({
      opacity: 1,
      transition: {
        delay: delay + i * stagger + duration,
        duration: 0.01,
      },
    }),
  };

  const renderLine = (content: React.ReactNode, index: number) => (
    <div key={index} className="relative w-fit overflow-hidden block">
      <motion.div
        variants={textVariants}
        initial="initial"
        animate={(!animateOnScroll || isInView) ? "animate" : "initial"}
        custom={index}
      >
        {content}
      </motion.div>

      <motion.div
        variants={blockVariants}
        initial="initial"
        animate={(!animateOnScroll || isInView) ? "animate" : "initial"}
        custom={index}
        className="absolute inset-0 z-10"
        style={{ backgroundColor: blockColor }}
      />
    </div>
  );

  return (
    <div
      className="flex flex-col items-start justify-center"
      ref={containerRef}
    >
      {Array.isArray(children)
        ? children.map((line, i) => renderLine(line, i))
        : renderLine(children, 0)}
    </div>
  );
};
