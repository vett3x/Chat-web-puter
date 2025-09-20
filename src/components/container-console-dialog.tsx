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
import 'xterm/css/xterm.css';

interface ContainerConsoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: { id: string };
  container: DockerContainer;
}

export function ContainerConsoleDialog({ open, onOpenChange, server, container }: ContainerConsoleDialogProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { session } = useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any | null>(null); // To hold the xterm instance

  const initializeSocket = useCallback(async (term: any) => {
    if (!session?.user?.id || typeof window === 'undefined') {
      term.writeln('\x1b[31m[CLIENT] Error: Sesión de usuario no encontrada.\x1b[0m');
      return;
    }

    try {
      // Removed fetch('/api/socket') as the WebSocket server will run independently
      term.writeln('\x1b[32m[CLIENT] Servidor de sockets asumido como activo.\x1b[0m');

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.hostname;
      const wsUrl = `${protocol}://${host}:3001?serverId=${server.id}&containerId=${container.ID}&userId=${session.user.id}`;
      
      term.writeln(`\x1b[33m[CLIENT] Conectando a: ${wsUrl}\x1b[0m`);
      console.log(`[ContainerConsoleDialog] Attempting WebSocket connection to: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        term.writeln('\r\n\x1b[32m[CLIENT] Conexión WebSocket establecida.\x1b[0m\r\n');
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
        } else {
          term.write(event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('[ContainerConsoleDialog] WebSocket error:', error);
        term.writeln(`\r\n\x1b[31m[CLIENT] --- Error de Conexión WebSocket ---\x1b[0m`);
        term.writeln(`\x1b[31m[CLIENT] No se pudo conectar a ${wsUrl}\x1b[0m`);
        term.writeln(`\x1b[31m[CLIENT] Por favor, verifica que el servidor de sockets esté corriendo en el puerto 3001 y que no haya problemas de red o firewall.\x1b[0m`);
      };

      ws.onclose = (event) => {
        if (!event.wasClean) {
          term.writeln(`\r\n\x1b[31m[CLIENT] --- Conexión perdida (código: ${event.code}) ---\x1b[0m`);
          term.writeln(`\x1b[31m[CLIENT] Razón: ${event.reason || 'Desconocida'}\x1b[0m`);
        } else {
          term.writeln(`\r\n\x1b[33m[CLIENT] --- Desconectado ---\x1b[0m`);
        }
      };
    } catch (e: any) {
      console.error('[ContainerConsoleDialog] Error during socket initialization:', e);
      term.writeln(`\x1b[31m[CLIENT] Error al inicializar el socket: ${e.message}\x1b[0m`);
      term.writeln(`\x1b[31m[CLIENT] Asegúrate de que el servidor Next.js esté funcionando y que la ruta /api/socket sea accesible.\x1b[0m`);
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
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('xterm-addon-fit');

        term = new Terminal({
          cursorBlink: true,
          convertEol: true,
          fontFamily: 'var(--font-geist-mono)',
          theme: { background: '#000000', foreground: '#FFFFFF' },
        });
        termRef.current = term;

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        
        term.writeln('\x1b[32m[CLIENT] Terminal inicializada.\x1b[0m');
        
        setTimeout(() => fitAddon.fit(), 10);

        term.onData((data: string) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current?.send(data);
          }
        });

        resizeObserver = new ResizeObserver(() => {
          try {
            fitAddon?.fit();
          } catch (e) {
            console.error('[ContainerConsoleDialog] ResizeObserver fit error:', e);
          }
        });
        resizeObserver.observe(terminalRef.current);

        await initializeSocket(term);
      }
    };

    initTerminal();

    return () => {
      resizeObserver?.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [open, initializeSocket]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] w-[80vw] h-[80vh] flex flex-col p-4">
        <DialogHeader className="px-2 pt-2">
          <DialogTitle>Consola Interactiva: {container.Names} ({container.ID.substring(0, 12)})</DialogTitle>
          <DialogDescription>
            Terminal en tiempo real conectada al contenedor.
          </DialogDescription>
        </DialogHeader>
        <div ref={terminalRef} className="flex-1 w-full h-full bg-black rounded-md p-2" />
      </DialogContent>
    </Dialog>
  );
}