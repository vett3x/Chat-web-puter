"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
}

interface DeepAiCoderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppCreated: (newApp: UserApp) => void;
}

export function DeepAiCoderDialog({ open, onOpenChange, onAppCreated }: DeepAiCoderDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast.error('Por favor, dale un nombre a tu proyecto.');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch('/api/apps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      });
      const newApp = await response.json();
      if (!response.ok) {
        throw new Error(newApp.message || 'Error al iniciar la creación de la aplicación.');
      }
      toast.success(`Iniciando la creación de "${projectName}"...`);
      onAppCreated(newApp);
      onOpenChange(false);
      setProjectName('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary-light-purple" /> Nuevo Proyecto DeepAI Coder
          </DialogTitle>
          <DialogDescription>
            Dale un nombre a tu aplicación. La IA generará el código, lo desplegará en un contenedor Docker y lo pondrá en línea por ti.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGenerate}>
          <div className="py-4">
            <Label htmlFor="project-name" className="text-left mb-2 block">
              Nombre del Proyecto
            </Label>
            <Input
              id="project-name"
              placeholder="Ej: 'Mi Tienda Gamer'"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isGenerating}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white" disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Crear Aplicación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}