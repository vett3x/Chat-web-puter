"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, Loader2, Paperclip, XCircle, Check, FileText, KeyRound, Search } from 'lucide-react'; // Import Search icon
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
import { AI_PROVIDERS, getModelLabel } from '@/lib/ai-models'; // Import getModelLabel
import GoogleGeminiLogo from '@/components/google-gemini-logo'; // Import explicitly for dynamic icon
import ClaudeAILogo from '@/components/claude-ai-logo'; // Import explicitly for dynamic icon
import { useUserApiKeys } from '@/hooks/use-user-api-keys';
import { Input } from '@/components/ui/input'; // Import Input for search

interface PuterTextContentPart { type: 'text'; text: string; }
interface PuterImageContentPart { type: 'image_url'; image_url: { url: string; }; }
type PuterContentPart = PuterTextContentPart | PuterImageContentPart;

interface ChatInputProps {
  isLoading: boolean;
  selectedModel: string; // Now in format 'puter:model-value' or 'user_key:key-id'
  onModelChange: (model: string) => void;
  sendMessage: (content: PuterContentPart[], messageText: string) => void;
  isAppChat?: boolean;
}

interface SelectedFile {
  file: File;
  preview?: string;
  type: 'image' | 'other';
}

export function ChatInput({ isLoading, selectedModel, onModelChange, sendMessage, isAppChat = false }: ChatInputProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const { userApiKeys } = useUserApiKeys();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState(''); // New state for search term

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

  const filteredProviderGroups = AI_PROVIDERS.filter(providerGroup => {
    const matchesSearch = searchTerm.toLowerCase();
    if (!isAppChat || providerGroup.source === 'user_key') {
      // Filter by provider name
      if (providerGroup.company.toLowerCase().includes(matchesSearch)) return true;

      // Filter by model labels for puter models
      if (providerGroup.source === 'puter' && providerGroup.models.some(model => model.label.toLowerCase().includes(matchesSearch))) return true;

      // Filter by user API key nicknames or model names for user_key models
      if (providerGroup.source === 'user_key') {
        const userKeysForProvider = userApiKeys.filter(key => key.provider === providerGroup.value);
        if (userKeysForProvider.some(key => 
          (key.nickname && key.nickname.toLowerCase().includes(matchesSearch)) ||
          (key.model_name && getModelLabel(key.model_name, userApiKeys).toLowerCase().includes(matchesSearch))
        )) return true;
      }
      return false;
    }
    return false;
  });

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
                <SelectedModelIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-64 bg-popover text-popover-foreground border-border rounded-lg">
              <DropdownMenuLabel className="text-sm font-semibold">Seleccionar Modelo de IA</DropdownMenuLabel>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0 focus:bg-transparent focus:text-current">
                <div className="relative mx-2 my-1 w-full">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar modelo o clave..."
                    className="pl-8 h-8 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              {filteredProviderGroups.length === 0 ? (
                <DropdownMenuItem disabled className="pl-8 cursor-not-allowed text-muted-foreground">
                  No se encontraron resultados.
                </DropdownMenuItem>
              ) : (
                filteredProviderGroups.map((providerGroup, index) => {
                  const isLastFilteredProvider = index === filteredProviderGroups.length - 1;

                  if (providerGroup.source === 'puter') {
                    return (
                      <React.Fragment key={providerGroup.value}>
                        <DropdownMenuLabel className="flex items-center gap-2 font-bold text-foreground px-2 py-1.5">
                          <span>{providerGroup.company}</span>
                          <providerGroup.logo className="h-4 w-4" />
                        </DropdownMenuLabel>
                        {providerGroup.models
                          .filter(model => model.label.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((model) => (
                            <DropdownMenuItem
                              key={model.value}
                              onClick={() => onModelChange(`puter:${model.value}`)} // New format
                              className={cn("flex items-center justify-between cursor-pointer pl-8", selectedModel === `puter:${model.value}` && "bg-accent text-accent-foreground")}
                            >
                              <span>{model.label}</span>
                              {selectedModel === `puter:${model.value}` && <Check className="h-4 w-4 text-green-500" />}
                            </DropdownMenuItem>
                          ))}
                        {!isLastFilteredProvider && <DropdownMenuSeparator className="bg-border" />}
                      </React.Fragment>
                    );
                  } else if (providerGroup.source === 'user_key') {
                    const userKeysForProvider = userApiKeys.filter(key => key.provider === providerGroup.value);
                    const hasAnyKey = userKeysForProvider.length > 0;

                    const filteredKeys = userKeysForProvider.filter(key =>
                      (key.nickname && key.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      (key.model_name && getModelLabel(key.model_name, userApiKeys).toLowerCase().includes(searchTerm.toLowerCase())) ||
                      providerGroup.company.toLowerCase().includes(searchTerm.toLowerCase())
                    );

                    if (filteredKeys.length === 0 && !providerGroup.company.toLowerCase().includes(searchTerm.toLowerCase())) {
                      return null; // Don't render provider group if no keys match and provider name doesn't match
                    }

                    return (
                      <React.Fragment key={providerGroup.value}>
                        <DropdownMenuLabel className={cn("flex items-center gap-2 font-bold text-foreground px-2 py-1.5", !hasAnyKey && "text-muted-foreground")}>
                          <span>{providerGroup.company}</span>
                          <providerGroup.logo className="h-4 w-4" />
                          {!hasAnyKey && <span title="Requiere API Key"><KeyRound className="h-4 w-4 text-muted-foreground" /></span>}
                        </DropdownMenuLabel>
                        {hasAnyKey ? (
                          filteredKeys.map(key => {
                            // Determine the display label based on nickname and Vertex AI usage
                            let displayLabelContent: string;
                            if (key.provider === 'custom_endpoint') {
                              displayLabelContent = key.nickname || `Endpoint Personalizado (${key.id.substring(0, 8)}...)`;
                            } else if (key.nickname) {
                              displayLabelContent = key.nickname;
                            } else {
                              const modelLabel = key.model_name ? getModelLabel(key.model_name, userApiKeys) : ''; // Pass userApiKeys
                              if (key.use_vertex_ai) {
                                displayLabelContent = `Vertex AI: ${modelLabel || 'Modelo no seleccionado'}`;
                              } else {
                                displayLabelContent = modelLabel || `${providerGroup.company} API Key`;
                              }
                            }
                            
                            const itemValue = `user_key:${key.id}`; // New format

                            return (
                              <DropdownMenuItem
                                key={key.id}
                                onClick={() => onModelChange(itemValue)}
                                className={cn("flex items-center justify-between cursor-pointer pl-8", selectedModel === itemValue && "bg-accent text-accent-foreground")}
                              >
                                <span>{displayLabelContent}</span>
                                {selectedModel === itemValue && <Check className="h-4 w-4 text-green-500" />}
                              </DropdownMenuItem>
                            );
                          })
                        ) : (
                          <DropdownMenuItem disabled className="pl-8 cursor-not-allowed text-muted-foreground">
                            No hay claves configuradas.
                          </DropdownMenuItem>
                        )}
                        {!isLastFilteredProvider && <DropdownMenuSeparator className="bg-border" />}
                      </React.Fragment>
                    );
                  }
                  return null;
                })
              )}
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