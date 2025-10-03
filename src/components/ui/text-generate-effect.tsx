"use client";
import { motion, Variants } from "framer-motion";
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
  const wordsArray = words.split(" ");

  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
      },
    },
  };

  const childVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.div
      className={cn("whitespace-pre-wrap", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onAnimationComplete={onAnimationComplete}
    >
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          variants={childVariants}
          className="inline-block"
        >
          {word}{" "}
        </motion.span>
      ))}
    </motion.div>
  );
};