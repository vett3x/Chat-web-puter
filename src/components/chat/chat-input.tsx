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
  selectedModel: string;
  onModelChange: (model: string) => void;
  sendMessage: (content: PuterContentPart[], messageText: string) => void;
}

interface SelectedFile {
  file: File;
  preview?: string;
  type: 'image' | 'other';
}

export function ChatInput({ isLoading, selectedModel, onModelChange, sendMessage }: ChatInputProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const response = await fetch('/api/ai-keys');
        const data = await response.json();
        if (response.ok) {
          const providers = [...new Set(data.map((key: any) => key.provider))] as string[];
          setAvailableKeys(providers);
        }
      } catch (error) {
        console.error("Failed to fetch API keys", error);
      }
    };
    fetchKeys();
  }, []);

  const SelectedModelIcon = React.useMemo(() => {
    for (const provider of AI_PROVIDERS) {
      if (provider.models.some(model => model.value === selectedModel)) {
        return provider.logo;
      }
    }
    return Bot; // Fallback to the generic bot icon
  }, [selectedModel]);

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
      <div className="w-full max-w-3xl bg-card rounded-xl border border-input shadow-lg p-2 flex flex-col gap-2 focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 focus-within:ring-offset-background focus-within:shadow-[0_0_20px_5px_rgb(34_197_94_/_0.4)] transition-all duration-200">
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
                <SelectedModelIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-64 bg-popover text-popover-foreground border-border rounded-lg">
              <DropdownMenuLabel className="text-sm font-semibold">Seleccionar Modelo de IA</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              {AI_PROVIDERS.map((provider, providerIndex) => {
                const requiresKey = provider.source === 'user_key';
                const hasKey = availableKeys.includes('google_gemini'); // Assuming provider name in DB is 'google_gemini'
                const isDisabled = requiresKey && !hasKey;

                return (
                  <React.Fragment key={provider.company}>
                    <DropdownMenuLabel className={cn("flex items-center gap-2 font-bold text-foreground px-2 py-1.5", isDisabled && "text-muted-foreground")}>
                      <span>{provider.company}</span>
                      <provider.logo className="h-4 w-4" />
                      {isDisabled && <KeyRound className="h-4 w-4 text-warning" title="Requiere API Key" />}
                    </DropdownMenuLabel>
                    {provider.models.map((model) => (
                      <DropdownMenuItem key={model.value} onClick={() => onModelChange(model.value)} disabled={isDisabled} className={cn("flex items-center justify-between cursor-pointer pl-8", selectedModel === model.value && "bg-accent text-accent-foreground", isDisabled && "cursor-not-allowed")}>
                        <span>{model.label}</span>
                        {selectedModel === model.value && <Check className="h-4 w-4 text-green-500" />}
                      </DropdownMenuItem>
                    ))}
                    {providerIndex < AI_PROVIDERS.length - 1 && <DropdownMenuSeparator className="bg-border" />}
                  </React.Fragment>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleSendMessage} disabled={isLoading || (!inputMessage.trim() && selectedFiles.length === 0)} className="flex-shrink-0 h-8 w-8 p-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}