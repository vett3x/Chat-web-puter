"use client";

import React from 'react';
import Image from 'next/image'; // Usar next/image para optimización

interface ClaudeAILogoProps {
  className?: string;
}

const ClaudeAILogo: React.FC<ClaudeAILogoProps> = ({ className }) => {
  return (
    <Image
      src="/claude_aI_logo.svg" 
      alt="Claude AI Logo"
      width={16} 
      height={16} 
      className={className}
      unoptimized={true} // Deshabilitar la optimización para este SVG
    />
  );
};

export default ClaudeAILogo;