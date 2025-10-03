"use client";
import { useEffect } from "react";
import { motion, stagger, useAnimate } from "framer-motion";
import { cn } from "@/lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
  onAnimationComplete,
}: {
  words: string;
  className?: string;
  onAnimationComplete?: () => void;
}) => {
  const [scope, animate] = useAnimate();
  let wordsArray = words.split(" ");
  useEffect(() => {
    const animation = animate(
      "span",
      {
        opacity: 1,
      },
      {
        duration: 0.5,
        delay: stagger(0.05),
      }
    );
    animation.then(() => {
      onAnimationComplete?.();
    });
  }, [animate, words, onAnimationComplete]);

  return (
    <motion.div ref={scope} className={cn(className)}>
      {wordsArray.map((word, idx) => {
        return (
          <motion.span
            key={word + idx}
            className="opacity-0"
          >
            {word}{" "}
          </motion.span>
        );
      })}
    </motion.div>
  );
};