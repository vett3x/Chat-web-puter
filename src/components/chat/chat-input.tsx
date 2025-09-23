"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, Loader2, Paperclip, XCircle, Check } from 'lucide-react';
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
import ClaudeAILogo from '@/components/claude-ai-logo';

interface PuterTextContentPart { type: 'text'; text: string; }
interface PuterImageContentPart { type: 'image_url'; image_url: { url: string; }; }
type PuterContentPart = PuterTextContentPart | PuterImageContentPart;

const AI_PROVIDERS = [
  {
    company: 'Anthropic',
    logo: ClaudeAILogo,
    models: [
      { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
      { value: 'claude-opus-4', label: 'Claude Opus 4' },
      { value: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet' },
      { value: 'claude-3-7-opus', label: 'Claude 3.7 Opus' },
    ],
  },
];

interface ChatInputProps {
  isLoading: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  sendMessage: (content: PuterContentPart[], messageText: string) => void;
}

export function ChatInput({ isLoading, selectedModel, onModelChange, sendMessage }: ChatInputProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SelectedModelIcon = React.useMemo(() => {
    for (const provider of AI_PROVIDERS) {
      if (provider.models.some(model => model.value === selectedModel)) {
        return provider.logo;
      }
    }
    return Bot; // Fallback to the generic bot icon
  }, [selectedModel]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() && selectedImages.length === 0) return;

    const userContent: PuterContentPart[] = [];
    if (inputMessage.trim()) {
      userContent.push({ type: 'text', text: inputMessage });
    }
    selectedImages.forEach(img => {
      userContent.push({ type: 'image_url', image_url: { url: img.preview } });
    });

    sendMessage(userContent, inputMessage);
    setInputMessage('');
    setSelectedImages([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files)
      .filter(file => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024)
      .map(file => ({ file, preview: URL.createObjectURL(file) }));
    
    if (newImages.length !== files.length) {
      toast.error('Solo se permiten imágenes de hasta 5MB.');
    }
    setSelectedImages(prev => [...prev, ...newImages].slice(0, 4));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
    event.target.value = '';
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    processFiles(event.clipboardData?.files);
  };

  const removeImage = (indexToRemove: number) => {
    setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 flex justify-center px-4 pb-4 pt-2">
      <div className="w-full max-w-3xl bg-card rounded-xl border border-input shadow-lg p-2 flex flex-col gap-2 focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 focus-within:ring-offset-background focus-within:shadow-[0_0_20px_5px_rgb(34_197_94_/_0.4)] transition-all duration-200">
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-input">
            {selectedImages.map((img, index) => (
              <div key={index} className="relative w-24 h-24 rounded-md overflow-hidden">
                <Image src={img.preview} alt={`Preview ${index}`} layout="fill" objectFit="cover" className="rounded-md" />
                <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 rounded-full bg-background/70 hover:bg-background text-destructive hover:text-destructive-foreground" onClick={() => removeImage(index)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading || selectedImages.length >= 4} className="flex-shrink-0 text-muted-foreground hover:text-foreground h-8 w-8 p-0" aria-label="Adjuntar archivo">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} onPaste={handlePaste} placeholder="Pregunta a Claude AI..." disabled={isLoading} className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none max-h-[200px] overflow-y-auto bg-transparent px-3 py-1.5 min-h-8" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className="rounded-full bg-info text-info-foreground shadow-avatar-user hover:shadow-avatar-user-hover transition-all duration-200 h-8 w-8 p-0" aria-label="Seleccionar modelo de IA">
                <SelectedModelIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-64 bg-popover text-popover-foreground border-border rounded-lg">
              <DropdownMenuLabel className="text-sm font-semibold">Seleccionar Modelo de IA</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              {AI_PROVIDERS.map((provider, providerIndex) => (
                <React.Fragment key={provider.company}>
                  <DropdownMenuLabel className="flex items-center gap-2 font-bold text-foreground px-2 py-1.5">
                    <span>{provider.company}</span>
                    <provider.logo className="h-4 w-4" />
                  </DropdownMenuLabel>
                  {provider.models.map((model) => (
                    <DropdownMenuItem key={model.value} onClick={() => onModelChange(model.value)} className={cn("flex items-center justify-between cursor-pointer pl-8", selectedModel === model.value && "bg-accent text-accent-foreground")}>
                      <span>{model.label}</span>
                      {selectedModel === model.value && <Check className="h-4 w-4 text-green-500" />}
                    </DropdownMenuItem>
                  ))}
                  {providerIndex < AI_PROVIDERS.length - 1 && <DropdownMenuSeparator className="bg-border" />}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleSendMessage} disabled={isLoading || (!inputMessage.trim() && selectedImages.length === 0)} className="flex-shrink-0 h-8 w-8 p-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}