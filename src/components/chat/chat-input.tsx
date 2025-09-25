"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, Loader2, Paperclip, XCircle, Check, FileText, KeyRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AI_PROVIDERS } from '@/lib/ai-models';

interface PuterTextContentPart { type: 'text'; text: string; }
interface PuterImageContentPart { type: 'image_url'; image_url: { url: string; }; }
type PuterContentPart = PuterTextContentPart | PuterImageContentPart;

interface ChatInputProps {
  isLoading: boolean;
  selectedApiKeyId: string | null;
  onModelChange: (apiKeyId: string | null) => void;
  sendMessage: (content: PuterContentPart[], messageText: string) => void;
  isAppChat?: boolean;
  availableKeys: ApiKey[];
  setAvailableKeys: (keys: ApiKey[]) => void;
}

interface SelectedFile {
  file: File;
  preview?: string;
  type: 'image' | 'other';
}

interface ApiKey {
  id: string;
  provider: string;
  model_name: string | null;
  nickname: string | null;
}

export function ChatInput({ isLoading, selectedApiKeyId, onModelChange, sendMessage, isAppChat = false, availableKeys, setAvailableKeys }: ChatInputProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const response = await fetch('/api/ai-keys');
        const data = await response.json();
        if (response.ok) {
          setAvailableKeys(data);
          // If no key is selected, or the selected one is no longer available, select the first available option.
          const allOptions = [
            ...AI_PROVIDERS.filter(p => p.source === 'puter').flatMap(p => p.models.map(m => m.value)),
            ...data.map((k: ApiKey) => k.id)
          ];
          const currentSelectionIsValid = allOptions.includes(selectedApiKeyId || '');
          
          if (!currentSelectionIsValid && allOptions.length > 0) {
            onModelChange(allOptions[0]);
          } else if (!selectedApiKeyId && allOptions.length > 0) {
            onModelChange(allOptions[0]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch API keys", error);
      }
    };
    fetchKeys();
  }, []); // Run once on mount

  const selectedKey = availableKeys.find(k => k.id === selectedApiKeyId);

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
    <div className="absolute bottom-0 left-0 right-0 flex justify-center px-4 pb-4 pt-2">
      <div className="w-full max-w-3xl bg-card rounded-xl border border-input p-2 flex flex-col gap-2 focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 focus-within:ring-offset-background transition-all duration-200">
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-input">
            {selectedFiles.map((item, index) => (
              <div key={index} className="relative w-24 h-24 rounded-md overflow-hidden border bg-muted">
                {item.type === 'image' && item.preview ? (
                  <Image src={item.preview} alt={`Preview ${item.file.name}`} layout="fill" objectFit="cover" className="rounded-md" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-2 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground w-full truncate mt-1" title={item.file.name}>{item.file.name}</p>
                  </div>
                )}
                <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 rounded-full bg-background/70 hover:bg-background text-destructive hover:text-destructive-foreground" onClick={() => removeFile(index)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading || selectedFiles.length >= 10} className="flex-shrink-0 text-muted-foreground hover:text-foreground h-8 w-8 p-0" aria-label="Adjuntar archivo">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} onPaste={handlePaste} placeholder="Pregunta a la IA..." disabled={isLoading} className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none max-h-[200px] overflow-y-auto bg-transparent px-3 py-1.5 min-h-8" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className="rounded-full bg-info text-info-foreground shadow-avatar-user hover:shadow-avatar-user-hover transition-all duration-200 h-8 w-8 p-0" aria-label="Seleccionar modelo de IA">
                <KeyRound className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-64 bg-popover text-popover-foreground border-border rounded-lg">
              {AI_PROVIDERS.map((provider) => {
                const userKeysForProvider = availableKeys.filter(key => key.provider === provider.providerKey);
                const hasPuterModels = provider.source === 'puter' && provider.models.length > 0;
                const hasUserKeys = provider.source === 'user_key' && userKeysForProvider.length > 0;

                if (!hasPuterModels && !hasUserKeys) return null;

                return (
                  <React.Fragment key={provider.company}>
                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground flex items-center gap-2 pt-2">
                      <provider.logo className="h-4 w-4" /> {provider.company}
                    </DropdownMenuLabel>
                    {hasPuterModels && provider.models.map(model => (
                      <DropdownMenuItem key={model.value} onClick={() => onModelChange(model.value)} className={cn("flex items-center justify-between cursor-pointer", selectedApiKeyId === model.value && "bg-accent text-accent-foreground")}>
                        <span>{model.label}</span>
                        {selectedApiKeyId === model.value && <Check className="h-4 w-4 text-green-500" />}
                      </DropdownMenuItem>
                    ))}
                    {hasUserKeys && userKeysForProvider.map(key => (
                      <DropdownMenuItem key={key.id} onClick={() => onModelChange(key.id)} className={cn("flex items-center justify-between cursor-pointer", selectedApiKeyId === key.id && "bg-accent text-accent-foreground")}>
                        <div className="flex flex-col">
                          <span className="font-medium">{key.nickname || key.model_name}</span>
                          <span className="text-xs text-muted-foreground">{key.model_name}</span>
                        </div>
                        {selectedApiKeyId === key.id && <Check className="h-4 w-4 text-green-500" />}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-border last:hidden" />
                  </React.Fragment>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleSendMessage} disabled={isLoading || (!inputMessage.trim() && selectedFiles.length === 0)}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}