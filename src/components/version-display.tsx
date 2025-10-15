"use client";

import React, { useState, useEffect } from 'react';
import { Skeleton } from './ui/skeleton';

export function VersionDisplay() {
  const [version, setVersion] = useState<string | null>(null);
  const [buildNumber, setBuildNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch('/api/settings/public-version');
        if (response.ok) {
          const data = await response.json();
          setVersion(data.app_version);
          setBuildNumber(data.app_build_number);
        }
      } catch (error) {
        console.error("Failed to fetch app version:", error);
        setVersion("Error");
        setBuildNumber("Error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersion();
  }, []);

  return (
    <div className="px-2 py-2 pb-4 text-center text-xs text-sidebar-foreground/50">
      {isLoading ? (
        <div className="space-y-1">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-4 w-20 mx-auto" />
        </div>
      ) : (
        <>
          <p>
            Versión: <span className="font-semibold">next-template@{version}</span>
          </p>
          <p>
            Compilación: <span className="font-semibold">{buildNumber}</span>
          </p>
        </>
      )}
    </div>
  );
}