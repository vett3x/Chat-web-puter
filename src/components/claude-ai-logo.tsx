"use client";

import React from 'react';

interface ClaudeAILogoProps {
  className?: string;
}

const ClaudeAILogo: React.FC<ClaudeAILogoProps> = ({ className }) => {
  return (
    <img
      src="/claude_aI_logo.svg.png"
      alt="Claude AI Logo"
      width={16} // Mantenemos el ancho
      // Eliminamos la propiedad height para que la imagen mantenga su relación de aspecto
      className={`object-contain ${className}`} // Añadimos object-contain para asegurar que la imagen se ajuste sin recortarse
    />
  );
};

export default ClaudeAILogo;