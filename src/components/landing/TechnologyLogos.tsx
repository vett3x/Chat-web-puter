"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';

interface TechnologyLogo {
  name: string;
  logo_url: string;
}

export function TechnologyLogos() {
  const [logos, setLogos] = useState<TechnologyLogo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const response = await fetch('/api/public/technology-logos');
        if (!response.ok) {
          throw new Error('Failed to fetch logos');
        }
        const data = await response.json();
        setLogos(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogos();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 text-white/50">
      {logos.map((tech) => (
        <div key={tech.name} title={tech.name} className="relative h-10 w-24 filter grayscale hover:grayscale-0 transition-all duration-300">
          <Image
            src={tech.logo_url}
            alt={tech.name}
            layout="fill"
            objectFit="contain"
          />
        </div>
      ))}
    </div>
  );
}