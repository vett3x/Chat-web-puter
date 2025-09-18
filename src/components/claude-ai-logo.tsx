"use client";

import React from 'react';
import Image from 'next/image'; // Usar next/image para optimización

interface ClaudeAILogoProps {
  className?: string;
}

const ClaudeAILogo: React.FC<ClaudeAILogoProps> = ({ className }) => {
  return (
    <Image
      src="/claude_ai_logo.svg" // ¡Aquí está la corrección a .svg!
      alt="Claude AI Logo"
      width={16} // Ajusta el tamaño según sea necesario
      height={16} // Ajusta el tamaño según sea necesario
      className={className}
    />
  );
};

export default ClaudeAILogo;