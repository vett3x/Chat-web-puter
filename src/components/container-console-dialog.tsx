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

  const initializeSocket = useCallback(async () => {
    if (!session?.user?.id) return;

    // First, ensure the WebSocket server is running by pinging the API route
    await fetch('/api/socket');

    const ws = new WebSocket(`ws://localhost:3001?serverId=${server.id}&containerId=${container.ID}&userId=${session.user.id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established');
      termRef.current?.writeln('Conectado al contenedor...');
    };

    ws.onmessage = (event) => {
      // Data from server is ArrayBuffer, need to convert to Uint8Array for xterm
      if (event.data instanceof ArrayBuffer) {
        termRef.current?.write(new Uint8Array(event.data));
      } else {
        termRef.current?.write(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      termRef.current?.writeln('\r\n--- Error de conexión ---');
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      termRef.current?.writeln('\r\n--- Desconectado ---');
    };

  }, [server.id, container.ID, session?.user?.id]);

  useEffect(() => {
    const initializeTerminal = async () => {
      if (open && terminalRef.current && !termRef.current) {
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('xterm-addon-fit');

        const term = new Terminal({
          cursorBlink: true,
          convertEol: true,
          fontFamily: 'var(--font-geist-mono)',
          theme: {
            background: '#000000',
            foreground: '#FFFFFF',
          },
        });
        termRef.current = term;

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        // Handle user input
        term.onData((data) => {
          wsRef.current?.send(data);
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
          try {
            fitAddon.fit();
          } catch (e) {
            // This can throw if the terminal is not fully initialized, safe to ignore
          }
        });
        resizeObserver.observe(terminalRef.current);

        await initializeSocket();
      }
    };

    initializeTerminal();

    return () => {
      // Cleanup on dialog close or component unmount
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