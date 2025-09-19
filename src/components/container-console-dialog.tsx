"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DockerContainer } from '@/types/docker';

interface ConsoleLine {
  id: number;
  type: 'command' | 'output';
  content: string;
}

interface ContainerConsoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: { id: string };
  container: DockerContainer;
}

export function ContainerConsoleDialog({ open, onOpenChange, server, container }: ContainerConsoleDialogProps) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (open) {
      // Focus input when dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const command = input.trim();
    setIsLoading(true);
    setInput('');
    if (command) {
      setHistory(prev => [command, ...prev]);
    }
    setHistoryIndex(-1);

    setLines(prev => [...prev, { id: Date.now(), type: 'command', content: command }]);

    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers/${container.ID}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error al ejecutar el comando.');
      }
      setLines(prev => [...prev, { id: Date.now() + 1, type: 'output', content: result.output.trimEnd() || ' ' }]);
    } catch (err: any) {
      toast.error(err.message);
      setLines(prev => [...prev, { id: Date.now() + 1, type: 'output', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[70vh] flex flex-col p-4">
        <DialogHeader className="px-2 pt-2">
          <DialogTitle>Consola: {container.Names} ({container.ID.substring(0, 12)})</DialogTitle>
          <DialogDescription>
            Ejecuta comandos en el contenedor. El estado (directorio, variables) no se mantiene entre comandos.
          </DialogDescription>
        </DialogHeader>
        <div ref={outputRef} className="flex-1 bg-black text-white font-mono text-sm p-4 rounded-md overflow-y-auto my-2">
          {lines.map(line => (
            <div key={line.id}>
              {line.type === 'command' && <span className="text-green-400">$ </span>}
              <pre className="whitespace-pre-wrap inline">{line.content}</pre>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <span className="text-green-400 font-mono">$</span>
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="font-mono bg-black text-white border-gray-700 focus:ring-green-500"
            placeholder="Escribe un comando y presiona Enter"
            autoComplete="off"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </form>
      </DialogContent>
    </Dialog>
  );
}