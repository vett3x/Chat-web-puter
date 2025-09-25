"use client";

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, KeyRound, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_PROVIDERS, getModelLabel } from '@/lib/ai-models';
import { ApiKey } from '@/hooks/use-user-api-keys'; // Import ApiKey type

interface ModelSelectorDropdownProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  isLoading: boolean;
  userApiKeys: ApiKey[];
  isAppChat?: boolean;
  SelectedModelIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export function ModelSelectorDropdown({
  selectedModel,
  onModelChange,
  isLoading,
  userApiKeys,
  isAppChat = false,
  SelectedModelIcon,
}: ModelSelectorDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" className="rounded-full bg-info text-info-foreground shadow-avatar-user hover:shadow-avatar-user-hover transition-all duration-200 h-8 w-8 p-0" aria-label="Seleccionar modelo de IA">
          <SelectedModelIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-64 bg-popover text-popover-foreground border-border rounded-lg">
        <DropdownMenuLabel className="text-sm font-semibold">Seleccionar Modelo de IA</DropdownMenuLabel>
        <div className="p-2" onPointerDown={(e) => e.stopPropagation()}>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelo o clave..."
              className="pl-8 h-8 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              // Prevent keyboard events from closing dropdown
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
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
                        onClick={() => onModelChange(`puter:${model.value}`)}
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
                return null;
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
                      let displayLabelContent: string;
                      if (key.provider === 'custom_endpoint') {
                        displayLabelContent = key.nickname || `Endpoint Personalizado (${key.id.substring(0, 8)}...)`;
                      } else if (key.nickname) {
                        displayLabelContent = key.nickname;
                      } else {
                        const modelLabel = key.model_name ? getModelLabel(key.model_name, userApiKeys) : '';
                        if (key.use_vertex_ai) {
                          displayLabelContent = `Vertex AI: ${modelLabel || 'Modelo no seleccionado'}`;
                        } else {
                          displayLabelContent = modelLabel || `${providerGroup.company} API Key`;
                        }
                      }
                      
                      const itemValue = `user_key:${key.id}`;

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
  );
}