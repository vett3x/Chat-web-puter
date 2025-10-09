"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, Loader2, Paperclip, KeyRound, Trash2, MessageSquare, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { useUserApiKeys } from '@/hooks/use-user-api-keys';
import { FileAttachmentPreview } from './file-attachment-preview';
import { ModelSelectorDropdown } from './model-selector-dropdown';
import GoogleGeminiLogo from '@/components/google-gemini-logo';
import ClaudeAILogo from '@/components/claude-ai-logo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface PuterTextContentPart { type: 'text'; text: string; }
interface PuterImageContentPart { type: 'image_url'; image_url: { url: string; }; }
type PuterContentPart = PuterTextContentPart | PuterImageContentPart;

export type ChatMode = 'build' | 'chat';

interface ChatInputProps {
  isLoading: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  sendMessage: (content: PuterContentPart[], messageText: string) => void;
  isAppChat?: boolean;
  onClearChat: () => void;
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
}

interface SelectedFile {
  file: File;
  preview?: string;
  type: 'image' | 'other';
}

export function ChatInput({ isLoading, selectedModel, onModelChange, sendMessage, isAppChat = false, onClearChat, chatMode, onChatModeChange }: ChatInputProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const { userApiKeys, aiKeyGroups } = useUserApiKeys(); // NEW: Get aiKeyGroups
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      return KeyRound; // Default for user_key if provider not found, or for custom_endpoint
    }
    return Bot; // Fallback
  }, [selectedModel, userApiKeys]);

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    const currentFileCount = selectedFiles.length;
    const spaceLeft = 10 - currentFileCount;

    if (spaceLeft <= 0) {
      toast.info('Ya has alcanzado el límite de 10 archivos.');
      return;
    }

    const filesToAdd = Array.from(files).slice(0, spaceLeft);

    const newFiles: SelectedFile[] = filesToAdd
      .filter(file => {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          toast.error(`El archivo "${file.name}" supera el límite de 10MB y no fue añadido.`);
          return false;
        }
        return true;
      })
      .map(file => {
        if (file.type.startsWith('image/')) {
          return { file, preview: URL.createObjectURL(file), type: 'image' as const };
        }
        return { file, type: 'other' as const };
      });
    
    if (files.length > spaceLeft) {
      toast.info(`Se añadieron ${spaceLeft} archivos. Se alcanzó el límite de 10 archivos.`);
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && selectedFiles.length === 0) return;

    const textParts: PuterTextContentPart[] = [];
    const imageParts: PuterImageContentPart[] = [];

    if (inputMessage.trim()) {
      textParts.push({ type: 'text', text: inputMessage.trim() });
    }

    try {
      for (const selectedFile of selectedFiles) {
        if (selectedFile.type === 'image' && selectedFile.preview) {
          imageParts.push({ type: 'image_url', image_url: { url: selectedFile.preview } });
        } else {
          const content = await readFileAsText(selectedFile.file);
          const fileContext = `Contenido del archivo adjunto '${selectedFile.file.name}':\n\n\`\`\`\n${content}\n\`\`\``;
          textParts.push({ type: 'text', text: fileContext });
        }
      }
    } catch (error) {
      toast.error('Error al leer uno de los archivos. Asegúrate de que sea un archivo de texto válido.');
      console.error("File read error:", error);
      return;
    }

    const finalContent: PuterContentPart[] = [...textParts, ...imageParts];
    
    sendMessage(finalContent, inputMessage);
    setInputMessage('');
    setSelectedFiles([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
    if (event.target) event.target.value = '';
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    processFiles(event.clipboardData?.files);
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent pt-8">
      <div className="flex justify-center px-4 pb-4">
        <div 
          className="w-full max-w-3xl bg-[var(--chat-bubble-background-color)] backdrop-blur-[var(--chat-bubble-blur)] border border-[var(--chat-bubble-border-color)] rounded-xl p-2 flex flex-col gap-2 focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 focus-within:ring-offset-background transition-all duration-200"
        >
          <FileAttachmentPreview selectedFiles={selectedFiles} onRemoveFile={removeFile} />
          
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
            <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading || selectedFiles.length >= 10} className="flex-shrink-0 text-muted-foreground hover:text-foreground h-8 w-8 p-0" aria-label="Adjuntar archivo">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} onPaste={handlePaste} placeholder="Pregunta a la IA..." disabled={isLoading} className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none max-h-[200px] overflow-y-auto bg-transparent px-3 py-1.5 min-h-8" />
            
            {isAppChat && (
              <ToggleGroup
                type="single"
                value={chatMode}
                onValueChange={(value: ChatMode) => {
                  if (value) onChatModeChange(value);
                }}
                className="flex-shrink-0"
                disabled={isLoading}
              >
                <ToggleGroupItem value="build" aria-label="Modo Build" className="h-8 px-2.5">
                  <Wrench className="h-4 w-4 mr-1.5" />
                  <span className="text-xs">Build</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="chat" aria-label="Modo Chat" className="h-8 px-2.5">
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  <span className="text-xs">Chat</span>
                </ToggleGroupItem>
              </ToggleGroup>
            )}

            <ModelSelectorDropdown
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              isLoading={isLoading}
              userApiKeys={userApiKeys}
              aiKeyGroups={aiKeyGroups} // NEW: Pass aiKeyGroups
              isAppChat={isAppChat}
              SelectedModelIcon={SelectedModelIcon}
            />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" disabled={isLoading} title="Limpiar chat">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro de limpiar este chat?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente todos los mensajes de esta conversación.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Limpiar Chat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button onClick={handleSendMessage} disabled={isLoading || (!inputMessage.trim() && selectedFiles.length === 0)} className="flex-shrink-0 h-8 w-8 p-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}