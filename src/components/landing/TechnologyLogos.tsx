"use client";

import React from 'react';

const technologies = [
  { name: 'Next.js', path: '/logos/nextjs.svg' },
  { name: 'Supabase', path: '/logos/supabase.svg' },
  { name: 'Docker', path: '/logos/docker.svg' },
  { name: 'Tailwind CSS', path: '/logos/tailwind.svg' },
  { name: 'Cloudflare', path: '/logos/cloudflare.svg' },
];

export function TechnologyLogos() {
  return (
    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 text-white/50">
      {technologies.map((tech) => (
        <div key={tech.name} title={tech.name}>
          <div
            style={{
              backgroundColor: 'currentColor',
              maskImage: `url(${tech.path})`,
              WebkitMaskImage: `url(${tech.path})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
            className="h-10 w-10"
          />
        </div>
      ))}
    </div>
  );
}