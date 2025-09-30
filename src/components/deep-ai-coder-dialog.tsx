"use client";

import React, { useState, useEffect } from 'react';
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
import { Wand2, Loader2, Send, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
  prompt: string | null;
  main_purpose: string | null;
  key_features: string | null;
  preferred_technologies: string | null;
}

interface DeepAiCoderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppCreated: (newApp: UserApp) => void;
}

const questions = [
  { key: 'name', prompt: '¡Hola! Soy tu asistente. ¿Cómo se llamará tu aplicación?', placeholder: 'Ej: Mi increíble app de fotos' },
  { key: 'main_purpose', prompt: 'Perfecto. Ahora, ¿cuál es el propósito principal de tu aplicación? Sé lo más descriptivo posible.', placeholder: 'Ej: Una red social para compartir fotos de paisajes' },
  { key: 'key_features', prompt: 'Entendido. ¿Hay alguna característica clave o funcionalidad específica que te gustaría incluir? (Opcional)', placeholder: 'Ej: Perfiles de usuario, subida de imágenes, sistema de "me gusta"' },
  { key: 'preferred_technologies', prompt: 'Genial. Finalmente, ¿tienes alguna tecnología o framework preferido, además de Next.js y Tailwind? (Opcional)', placeholder: 'Ej: Drizzle ORM, Auth.js' },
];

export function DeepAiCoderDialog({ open, onOpenChange, onAppCreated }: DeepAiCoderDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [projectDetails, setProjectDetails] = useState({ name: '', main_purpose: '', key_features: '', preferred_technologies: '' });
  const [userInput, setUserInput] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isGeneratingApp, setIsGeneratingApp] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setCurrentStep(0);
      setProjectDetails({ name: '', main_purpose: '', key_features: '', preferred_technologies: '' });
      setUserInput('');
      setIsTransitioning(false);
      setIsGeneratingApp(false);
    }
  }, [open]);

  const handleNextStep = () => {
    if (!userInput.trim() && questions[currentStep].key !== 'key_features' && questions[currentStep].key !== 'preferred_technologies') {
      toast.error('Por favor, responde a la pregunta.');
      return;
    }

    setIsTransitioning(true);
    setTimeout(() => {
      setProjectDetails(prev => ({ ...prev, [questions[currentStep].key]: userInput.trim() }));
      setCurrentStep(prev => prev + 1);
      setUserInput('');
      setIsTransitioning(false);
    }, 300); // Match animation duration
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNextStep();
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingApp(true);
    try {
      const response = await fetch('/api/apps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectDetails),
      });
      const newApp = await response.json();
      if (!response.ok) throw new Error(newApp.message || 'Error al iniciar la creación de la aplicación.');
      toast.success(`Iniciando la creación de "${projectDetails.name}"...`);
      onAppCreated(newApp);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGeneratingApp(false);
    }
  };

  const renderStepContent = () => {
    if (currentStep >= questions.length) {
      return (
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">¡Todo listo para empezar!</h3>
          <p className="text-muted-foreground">He recopilado toda la información necesaria. Cuando estés listo, crearé la base de tu proyecto.</p>
          <div className="text-left bg-muted p-4 rounded-lg text-sm space-y-2">
            <p><strong>Nombre:</strong> {projectDetails.name}</p>
            <p><strong>Propósito:</strong> {projectDetails.main_purpose}</p>
            <p><strong>Características:</strong> {projectDetails.key_features || 'No especificadas'}</p>
            <p><strong>Tecnologías:</strong> {projectDetails.preferred_technologies || 'No especificadas'}</p>
          </div>
        </div>
      );
    }

    const { prompt, placeholder } = questions[currentStep];
    return (
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center shadow-md">
          <Bot className="h-6 w-6 text-secondary-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground">{prompt}</p>
        <Textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={isTransitioning}
          className="w-full resize-none min-h-20"
          autoFocus
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-8 flex flex-col">
        <DialogHeader className="text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-2xl">
            <Wand2 className="h-6 w-6 text-primary-light-purple" /> Nuevo Proyecto DeepAI Coder
          </DialogTitle>
          <DialogDescription>
            Déjame guiarte para definir tu nueva aplicación.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 flex items-center justify-center">
          <div className={cn('w-full transition-opacity duration-300', isTransitioning ? 'animate-fade-out' : 'animate-fade-in')}>
            {renderStepContent()}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isGeneratingApp}>Cancelar</Button>
          </DialogClose>
          {currentStep < questions.length ? (
            <Button onClick={handleNextStep} disabled={isTransitioning}>
              Siguiente <Send className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white" onClick={handleGenerate} disabled={isGeneratingApp}>
              {isGeneratingApp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Crear Aplicación
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}