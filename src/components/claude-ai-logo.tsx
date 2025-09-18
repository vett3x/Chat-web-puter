"use client";

import React from 'react';

interface ClaudeAILogoProps {
  className?: string;
}

const ClaudeAILogo: React.FC<ClaudeAILogoProps> = ({ className }) => {
  return (
    <img
      src="/claude_aI_logo.svg.png" // Ruta corregida para el archivo PNG
      alt="Claude AI Logo"
      width={16}
      height={16}
      className={className}
    />
  );
};

export default ClaudeAILogo;