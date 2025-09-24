"use client";

import React from 'react';

interface GoogleGeminiLogoProps {
  className?: string;
}

const GoogleGeminiLogo: React.FC<GoogleGeminiLogoProps> = ({ className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      width="16"
      height="16"
    >
      <path d="M12 17.77L18.18 21.92L16.54 14.97L22 10.24L14.91 9.63L12 3L9.09 9.63L2 10.24L7.46 14.97L5.82 21.92L12 17.77Z" />
    </svg>
  );
};

export default GoogleGeminiLogo;