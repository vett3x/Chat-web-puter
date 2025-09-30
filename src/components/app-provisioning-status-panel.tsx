"use client";

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface AppProvisioningStatusPanelProps {
  appId: string;
  onProvisioningComplete: () => void;
}

export function AppProvisioningStatusPanel({ appId, onProvisioningComplete }: AppProvisioningStatusPanelProps) {
  // We no longer need to manage the log state or ref for the simplified UI
  // The polling logic is still needed to detect when provisioning is complete

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/apps/${appId}/provisioning-log`);
        const data = await response.json();
        if (!response.ok) {
          console.error("Polling error:", data.message);
          // Stop polling on error, but don't block the UI
          return;
        }
        if (data.status === 'ready' || data.status === 'failed') {
          onProvisioningComplete();
        }
      } catch (error) {
        console.error("Polling error:", error);
        // Stop polling on error
        return;
      }
    };

    const intervalId = setInterval(pollStatus, 3000);
    pollStatus(); // Initial fetch

    return () => clearInterval(intervalId);
  }, [appId, onProvisioningComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h3 className="text-lg font-semibold">Aprovisionando Entorno</h3>
      <p>Esto puede tardar unos minutos. Por favor, espera...</p>
    </div>
  );
}