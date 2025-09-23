"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DockerContainer } from '@/types/docker';
import { useSession } from '@/components/session-context-provider';
import '@xterm/xterm/css/xterm.css';

interface ContainerLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: { id: string };
  container: DockerContainer;
}

export function ContainerLogsDialog({ open, onOpenChange, server, container }: ContainerLogsDialogProps) {
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
      ws.onerror = (error) => {
        console.error('[ContainerLogsDialog] WebSocket error:', error);
        term.writeln(`\r\n\x1b[31m[CLIENT] Error de Conexión WebSocket.\x1b[0m`);
      };
      ws.onclose = (event) => {
        if (!event.wasClean) {
          term.writeln(`\r\n\x1b[31m[CLIENT] Conexión perdida (código: ${event.code})\x1b[0m`);
        } else {
          term.writeln(`\r\n\x1b[33m[CLIENT] Desconectado de logs.\x1b[0m`);
        }
      };

    } catch (e: any) {
      term.writeln(`\x1b[31m[CLIENT] Error al inicializar el socket: ${e.message}\x1b[0m`);
    }
  }, [server.id, container.ID, session?.user.id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let term: any = null;
    let fitAddon: any = null;
    let resizeObserver: ResizeObserver | null = null;

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

        resizeObserver = new ResizeObserver(() => {
          try {
            fitAddon?.fit();
          } catch (e) {
            console.error('[ContainerLogsDialog] ResizeObserver fit error:', e);
          }
        });
        resizeObserver.observe(terminalRef.current);

        await initializeSocket(term);
      }
    };

    initTerminal();

    return () => {
      resizeObserver?.disconnect();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
    };
  }, [open, initializeSocket]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] w-[80vw] h-[80vh] flex flex-col p-4">
        <DialogHeader className="px-2 pt-2">
          <DialogTitle>Logs en Vivo: {container.Names} ({container.ID.substring(0, 12)})</DialogTitle>
          <DialogDescription>
            Mostrando la salida del contenedor en tiempo real.
          </DialogDescription>
        </DialogHeader>
        <div ref={terminalRef} className="flex-1 w-full h-full bg-black rounded-md p-2" />
      </DialogContent>
    </Dialog>
  );
}