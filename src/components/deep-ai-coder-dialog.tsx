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
import { Textarea } from '@/components/ui/textarea'; // Importar Textarea
import { Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
  prompt: string | null;
  main_purpose: string | null; // NEW
  key_features: string | null; // NEW
  preferred_technologies: string | null; // NEW
}

interface DeepAiCoderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppCreated: (newApp: UserApp) => void;
}

export function DeepAiCoderDialog({ open, onOpenChange, onAppCreated }: DeepAiCoderDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [mainPurpose, setMainPurpose] = useState(''); // NEW state for main purpose
  const [keyFeatures, setKeyFeatures] = useState(''); // NEW state for key features
  const [preferredTechnologies, setPreferredTechnologies] = useState(''); // NEW state for preferred technologies
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !mainPurpose.trim()) { // Only mainPurpose is strictly required for now
      toast.error('Por favor, completa el nombre y el propósito principal del proyecto.');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch('/api/apps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: projectName, 
          main_purpose: mainPurpose, // Send new fields
          key_features: keyFeatures,
          preferred_technologies: preferredTechnologies,
        }),
      });
      const newApp = await response.json();
      if (!response.ok) {
        throw new Error(newApp.message || 'Error al iniciar la creación de la aplicación.');
      }
      toast.success(`Iniciando la creación de "${projectName}"...`);
      onAppCreated(newApp);
      onOpenChange(false);
      setProjectName('');
      setMainPurpose(''); // Reset new fields
      setKeyFeatures('');
      setPreferredTechnologies('');
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
            Describe tu aplicación. La IA generará el código, lo desplegará en un contenedor Docker y lo pondrá en línea por ti.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="py-4 space-y-4">
            <div>
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
            <div>
              <Label htmlFor="main-purpose" className="text-left mb-2 block">
                Propósito Principal de la Aplicación
              </Label>
              <Textarea
                id="main-purpose"
                placeholder="Ej: 'Una plataforma de e-commerce para vender videojuegos y accesorios.'"
                value={mainPurpose}
                onChange={(e) => setMainPurpose(e.target.value)}
                disabled={isGenerating}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="key-features" className="text-left mb-2 block">
                Características Clave (Opcional)
              </Label>
              <Textarea
                id="key-features"
                placeholder="Ej: 'Catálogo de productos, carrito de compras, autenticación de usuarios, pasarela de pago.'"
                value={keyFeatures}
                onChange={(e) => setKeyFeatures(e.target.value)}
                disabled={isGenerating}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="preferred-technologies" className="text-left mb-2 block">
                Tecnologías Preferidas (Opcional)
              </Label>
              <Textarea
                id="preferred-technologies"
                placeholder="Ej: 'Tailwind CSS para estilos, Shadcn/UI para componentes, React Hook Form para formularios.'"
                value={preferredTechnologies}
                onChange={(e) => setPreferredTechnologies(e.target.value)}
                disabled={isGenerating}
                rows={2}
              />
            </div>
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