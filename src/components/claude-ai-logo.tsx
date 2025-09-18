"use client";

import React from 'react';
// Eliminamos la importación de Image de next/image

interface ClaudeAILogoProps {
  className?: string;
}

const ClaudeAILogo: React.FC<ClaudeAILogoProps> = ({ className }) => {
  return (
    <img
      src="/claude_aI_logo.svg" // Usamos la ruta directa al SVG
      alt="Claude AI Logo"
      width={16} // Mantenemos el ancho para consistencia
      height={16} // Mantenemos el alto para consistencia
      className={className}
    />
  );
};

export default ClaudeAILogo;