"use client";

import React from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';

interface DeepAiCoderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeepAiCoderDialog({ open, onOpenChange }: DeepAiCoderDialogProps) {
  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info('La generación de código con despliegue automático está en desarrollo.');
    // Aquí iría la lógica compleja de la IA, despliegue, etc.
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary-light-purple" /> DeepAI Coder
          </DialogTitle>
          <DialogDescription>
            Describe la aplicación que quieres construir. La IA generará el código, lo desplegará en un contenedor Docker y lo pondrá en línea por ti.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGenerate}>
          <div className="py-4">
            <Label htmlFor="project-description" className="text-left mb-2 block">
              Describe tu proyecto
            </Label>
            <Textarea
              id="project-description"
              placeholder="Ej: 'Quiero una página web para vender productos para gamers, con un catálogo de productos, carrito de compras y un blog.'"
              className="min-h-[150px]"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white">
              <Wand2 className="mr-2 h-4 w-4" /> Generar Aplicación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}