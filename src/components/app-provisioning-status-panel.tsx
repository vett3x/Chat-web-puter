"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AppProvisioningStatusPanelProps {
  appId: string;
  onProvisioningComplete: () => void;
}

export function AppProvisioningStatusPanel({ appId, onProvisioningComplete }: AppProvisioningStatusPanelProps) {
  const [log, setLog] = useState<string>('Iniciando proceso de aprovisionamiento...');
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pollLogs = async () => {
      try {
        const response = await fetch(`/api/apps/${appId}/provisioning-log`);
        const data = await response.json();
        if (!response.ok) {
          // Stop polling on error, but show the last log message
          setLog(prevLog => prevLog + `\n\nError al cargar los logs: ${data.message}`);
          throw new Error(data.message || 'Error al cargar los logs.');
        }
        setLog(data.log);
        if (data.status === 'ready' || data.status === 'failed') {
          onProvisioningComplete();
        }
      } catch (error) {
        console.error("Polling error:", error);
        // Stop polling on error by not setting up the next interval
        return;
      }
    };

    const intervalId = setInterval(pollLogs, 3000);
    pollLogs(); // Initial fetch

    return () => clearInterval(intervalId);
  }, [appId, onProvisioningComplete]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className="h-full w-full flex flex-col bg-[#1E1E1E] text-white p-4">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="h-5 w-5 animate-spin" />
        <h3 className="text-lg font-semibold">Aprovisionando Entorno</h3>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Creando contenedor, configurando dominio y desplegando la base de Next.js... (Esto puede tardar unos minutos)
      </p>
      <div ref={logContainerRef} className="flex-1 overflow-auto rounded-md bg-black/50">
        <SyntaxHighlighter
          language="bash"
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: '1rem', fontSize: '0.8rem', lineHeight: '1.2rem', background: 'transparent' }}
          codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }}
          wrapLines={true}
          wrapLongLines={true}
        >
          {log}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}