"use client";

import React, { useState, useRef, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Loader2, Send, Bot, KeyRound, User } from 'lucide-react'; // Import User icon
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectCreationChat } from '@/hooks/use-project-creation-chat';
import { MessageContent } from './message-content';
import { useSession } from '@/components/session-context-provider';
import { useUserApiKeys } from '@/hooks/use-user-api-keys';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { ModelSelectorDropdown } from './chat/model-selector-dropdown';

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

export function DeepAiCoderDialog({ open, onOpenChange, onAppCreated }: DeepAiCoderDialogProps) {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { userApiKeys, isLoadingApiKeys } = useUserApiKeys();

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [userInput, setUserInput] = useState('');
  const [isGeneratingApp, setIsGeneratingApp] = useState(false); // NEW: Local state for app generation button

  const {
    messages,
    isLoading,
    isPuterReady,
    selectedModel,
    handleModelChange,
    sendMessage,
    projectDetails,
    isReadyToCreate,
  } = useProjectCreationChat({
    userId,
    userApiKeys,
    isLoadingApiKeys,
    onProjectDetailsGathered: (details) => {
      // This callback is triggered when the AI is ready to create
      // The actual creation will happen when the user clicks the button
      console.log("AI is ready to create project with details:", details);
    },
  });

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReadyToCreate || !projectDetails.name.trim() || !projectDetails.main_purpose.trim()) {
      toast.error('La IA aún no ha recopilado suficiente información o el nombre/propósito principal está vacío.');
      return;
    }
    
    // Use the projectDetails gathered by the AI
    const { name, main_purpose, key_features, preferred_technologies } = projectDetails;

    setIsGeneratingApp(true); // Use the new local state for the button
    try {
      const response = await fetch('/api/apps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          main_purpose, 
          key_features,
          preferred_technologies,
        }),
      });
      const newApp = await response.json();
      if (!response.ok) {
        throw new Error(newApp.message || 'Error al iniciar la creación de la aplicación.');
      }
      toast.success(`Iniciando la creación de "${name}"...`);
      onAppCreated(newApp);
      onOpenChange(false);
      setUserInput(''); // Clear input
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGeneratingApp(false); // Reset the new local state
    }
  };

  const handleUserSendMessage = async () => {
    await sendMessage(userInput);
    setUserInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserSendMessage();
    }
  };

  const SelectedModelIcon = React.useMemo(() => {
    if (selectedModel.startsWith('puter:')) {
      const modelValue = selectedModel.substring(6);
      for (const provider of AI_PROVIDERS) {
        if (provider.source === 'puter' && provider.models.some(model => model.value === modelValue)) {
          return provider.logo;
        }
      }
    } else if (selectedModel.startsWith('user_key:')) {
      const keyId = selectedModel.substring(9);
      const key = userApiKeys.find(k => k.id === keyId);
      if (key) {
        const provider = AI_PROVIDERS.find(p => p.value === key.provider);
        if (provider) return provider.logo;
      }
      return KeyRound;
    }
    return Bot;
  }, [selectedModel, userApiKeys]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-6 h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary-light-purple" /> Nuevo Proyecto DeepAI Coder
          </DialogTitle>
          <DialogDescription>
            Chatea con la IA para definir tu aplicación. Ella recopilará los detalles y la pondrá en línea por ti.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden py-4 flex flex-col">
          <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="flex-shrink-0">
                      {msg.role === 'user' ? (
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center"><User className="h-3 w-3 text-primary-foreground" /></div>
                      ) : (
                        <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center"><Bot className="h-3 w-3 text-secondary-foreground" /></div>
                      )}
                    </div>
                    <div className={`rounded-lg p-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {msg.isTyping ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        <MessageContent
                          message={msg}
                          content={msg.content}
                          isNew={msg.isNew}
                          aiResponseSpeed="normal"
                          isAppChat={false}
                          isConstructionPlan={false}
                          planApproved={false}
                          isCorrectionPlan={false}
                          correctionApproved={false}
                          isErrorAnalysisRequest={false}
                          isLoading={isLoading}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4 flex items-center gap-2 border-t pt-4">
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe tu proyecto..."
              disabled={isLoading || !isPuterReady || isLoadingApiKeys}
              className="flex-1 resize-none min-h-10"
              rows={1}
            />
            <ModelSelectorDropdown
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              isLoading={isLoading || !isPuterReady || isLoadingApiKeys}
              userApiKeys={userApiKeys}
              isAppChat={false}
              SelectedModelIcon={SelectedModelIcon}
            />
            <Button onClick={handleUserSendMessage} disabled={isLoading || !userInput.trim() || !isPuterReady || isLoadingApiKeys}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading || isGeneratingApp}>Cancelar</Button>
          </DialogClose>
          <Button type="submit" className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white" onClick={handleGenerate} disabled={isLoading || !isReadyToCreate || isGeneratingApp}>
            {isGeneratingApp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Crear Aplicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}