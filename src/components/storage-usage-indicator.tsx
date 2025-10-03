"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from './session-context-provider';
import { HardDrive, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function StorageUsageIndicator() {
  const { session } = useSession();
  const [usage, setUsage] = useState({ usage_bytes: 0, limit_mb: 100 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchUsage = async () => {
      try {
        const response = await fetch(`/api/users/${session.user.id}/storage`);
        if (!response.ok) throw new Error('Error al cargar el uso de almacenamiento.');
        const data = await response.json();
        setUsage(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  if (isLoading) {
    return (
      <div className="px-2 py-2 text-center text-xs text-sidebar-foreground/50 flex items-center justify-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Cargando uso...</span>
      </div>
    );
  }

  const usageMb = usage.usage_bytes / (1024 * 1024);
  const percentage = (usageMb / usage.limit_mb) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="px-4 py-2 space-y-1.5">
            <div className="flex justify-between items-center text-xs text-sidebar-foreground/80">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="h-3.5 w-3.5" />
                Almacenamiento
              </span>
              <span>{percentage.toFixed(1)}%</span>
            </div>
            <Progress value={percentage} className="h-1.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{formatBytes(usage.usage_bytes)} / {usage.limit_mb} MB</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}