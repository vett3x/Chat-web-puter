"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { useSession } from '@/components/session-context-provider';
import { DockerContainer } from '@/types/docker';
import '@xterm/xterm/css/xterm.css';

interface ContainerLiveLogsViewerProps {
  isOpen: boolean;
  server: { id: string };
  container: DockerContainer;
}

export function ContainerLiveLogsViewer({ isOpen, server, container }: ContainerLiveLogsViewerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { session } = useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any | null>(null);

  const initializeSocket = useCallback(async (term: any) => {
    if (!session?.user?.id || typeof window === 'undefined') {
      term.writeln('\x1b[31m[CLIENT] Error: Sesión de usuario no encontrada.\x1b[0m');
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.hostname;
      const wsPort = 3001;
      const wsUrl = `${protocol}://${host}:${wsPort}/?serverId=${server.id}&containerId=${container.ID}&userId=${session.user.id}&mode=logs`;
      
      term.writeln(`\x1b[33m[CLIENT] Conectando a logs...\x1b[0m`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => term.writeln('\r\n\x1b[32m[CLIENT] Conexión establecida. Mostrando logs...\x1b[0m\r\n');
      ws.onmessage = (event) => term.write(event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : event.data);
      ws.onerror = () => term.writeln(`\r\n\x1b[31m[CLIENT] Error de Conexión WebSocket.\x1b[0m`);
      ws.onclose = () => term.writeln(`\r\n\x1b[33m[CLIENT] Desconectado de logs.\x1b[0m`);

    } catch (e: any) {
      term.writeln(`\x1b[31m[CLIENT] Error al inicializar el socket: ${e.message}\x1b[0m`);
    }
  }, [server.id, container.ID, session?.user.id]);

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when collapsible is closed
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
      if (terminalRef.current) {
        terminalRef.current.innerHTML = '';
      }
      return;
    }

    let term: any = null;
    let fitAddon: any = null;

    const initTerminal = async () => {
      if (terminalRef.current && !termRef.current) {
        const { Terminal } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');

        term = new Terminal({
          cursorBlink: false,
          convertEol: true,
          fontFamily: 'var(--font-geist-mono)',
          theme: { background: '#1E1E1E', foreground: '#D4D4D4' },
          scrollback: 1000,
        });
        termRef.current = term;

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        
        setTimeout(() => fitAddon.fit(), 10);

        await initializeSocket(term);
      }
    };

    initTerminal();

    // This cleanup runs when the component unmounts (e.g., dialog closes)
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
    };
  }, [isOpen, initializeSocket]);

  return (
    <div className="p-2 bg-[#1E1E1E] rounded-b-md">
      <div ref={terminalRef} style={{ height: '400px', width: '100%' }} />
    </div>
  );
}