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
    hidden: { opacity: 1 }, // El contenedor en sí es visible
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04, // El retraso entre la animación de cada palabra
      },
    },
  };

  const childVariants: Variants = {
    hidden: { opacity: 0, y: 20 }, // Estado inicial de cada palabra: invisible y ligeramente desplazada
    visible: {
      opacity: 1,
      y: 0, // Estado final: visible y en su posición original
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
          className="inline-block" // Necesario para que la transformación 'y' funcione
        >
          {word}{" "}
        </motion.span>
      ))}
    </motion.div>
  );
};