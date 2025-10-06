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
import { toast } from 'sonner';

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

interface StorageUsageIndicatorProps {
  onOpenStorageManagement: () => void;
}

export function StorageUsageIndicator({ onOpenStorageManagement }: StorageUsageIndicatorProps) {
  const { session } = useSession();
  const [usage, setUsage] = useState({ usage_bytes: 0, limit_mb: 100 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!session?.user?.id) {
      if (isMounted) setIsLoading(false);
      return;
    }

    const fetchUsage = async (isInitialFetch: boolean) => {
      try {
        const response = await fetch(`/api/users/${session.user.id}/storage`);
        if (!response.ok) {
          if (isInitialFetch && isMounted) {
            toast.error('No se pudo cargar el uso de almacenamiento.');
          }
          console.error('Error al cargar el uso de almacenamiento.');
          return;
        }
        const data = await response.json();
        if (isMounted) {
          if (data && typeof data.usage_bytes === 'number' && typeof data.limit_mb === 'number') {
            setUsage(data);
          } else {
            console.error('Received invalid data shape for storage usage:', data);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error(error);
          if (isInitialFetch) {
            toast.error('Error de red al cargar el uso de almacenamiento.');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUsage(true);
    const interval = setInterval(() => fetchUsage(false), 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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
  const percentage = usage.limit_mb > 0 ? (usageMb / usage.limit_mb) * 100 : 0;

  return (
    <div className="px-4 py-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onOpenStorageManagement} className="w-full text-left space-y-1.5 cursor-pointer">
              <div className="flex justify-between items-center text-xs text-sidebar-foreground/80">
                <span className="flex items-center gap-1.5 font-medium">
                  <HardDrive className="h-3.5 w-3.5" />
                  Almacenamiento
                </span>
                <span>{percentage.toFixed(1)}%</span>
              </div>
              <Progress value={percentage} className="h-1.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{formatBytes(usage.usage_bytes)} / {usage.limit_mb} MB</p>
            <p className="text-xs text-muted-foreground">Haz clic para gestionar tus archivos.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}