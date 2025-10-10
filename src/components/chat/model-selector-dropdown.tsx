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
import { Check, KeyRound, Search, Folder, AlertCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_PROVIDERS, getModelLabel } from '@/lib/ai-models';
import { useSession } from '@/components/session-context-provider';
import { ApiKey, AiKeyGroup } from '@/hooks/use-user-api-keys';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModelSelectorDropdownProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  isLoading: boolean;
  userApiKeys: ApiKey[];
  aiKeyGroups: AiKeyGroup[];
  isAppChat?: boolean;
  SelectedModelIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export function ModelSelectorDropdown({
  selectedModel,
  onModelChange,
  isLoading,
  userApiKeys,
  aiKeyGroups,
  isAppChat = false,
  SelectedModelIcon,
}: ModelSelectorDropdownProps) {
  const { userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';

  const [searchTerm, setSearchTerm] = useState('');

  const filteredProviderGroups = AI_PROVIDERS.filter(providerGroup => {
    const matchesSearch = searchTerm.toLowerCase();
    if (!isAppChat || providerGroup.source === 'user_key') {
      if (providerGroup.company.toLowerCase().includes(matchesSearch)) return true;

      if (providerGroup.source === 'puter' && providerGroup.models.some(model => model.label.toLowerCase().includes(matchesSearch))) return true;

      if (providerGroup.source === 'user_key') {
        const groupsForProvider = aiKeyGroups.filter(group => group.provider === providerGroup.value);
        if (groupsForProvider.some(group => 
          group.name.toLowerCase().includes(matchesSearch) ||
          (group.model_name && getModelLabel(group.model_name, userApiKeys, aiKeyGroups).toLowerCase().includes(matchesSearch)) ||
          group.api_keys?.some(key => (key.nickname && key.nickname.toLowerCase().includes(matchesSearch)))
        )) return true;

        const standaloneKeysForProvider = userApiKeys.filter(key => key.provider === providerGroup.value && !key.group_id);
        if (standaloneKeysForProvider.some(key => 
          (key.nickname && key.nickname.toLowerCase().includes(matchesSearch)) ||
          (key.model_name && getModelLabel(key.model_name, userApiKeys, aiKeyGroups).toLowerCase().includes(matchesSearch))
        )) return true;
      }
      return false;
    }
    return false;
  });

  const renderStatusIcon = (status: ApiKey['status']) => {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {status === 'failed' ? (
              <AlertCircle className="h-3 w-3 text-destructive" />
            ) : status === 'blocked' ? (
              <Ban className="h-3 w-3 text-destructive" />
            ) : null}
          </TooltipTrigger>
          <TooltipContent>
            {status === 'failed' ? 'Clave fallida' : status === 'blocked' ? 'Clave bloqueada' : ''}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" className="rounded-full bg-info text-info-foreground shadow-avatar-user hover:shadow-avatar-user-hover transition-all duration-200 h-8 w-8 p-0" aria-label="Seleccionar modelo de IA">
          <SelectedModelIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-64 rounded-lg">
        <DropdownMenuLabel className="text-sm font-semibold">Seleccionar Modelo de IA</DropdownMenuLabel>
        <div className="p-2" onPointerDown={(e) => e.stopPropagation()}>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelo o clave..."
              className="pl-8 h-8 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                        disabled={isLoading}
                      >
                        <span>{model.label}</span>
                        {selectedModel === `puter:${model.value}` && <Check className="h-4 w-4 text-green-500" />}
                      </DropdownMenuItem>
                    ))}
                  {!isLastFilteredProvider && <DropdownMenuSeparator className="bg-border" />}
                </React.Fragment>
              );
            } else if (providerGroup.source === 'user_key') {
              const groupsForProvider = aiKeyGroups.filter(group => group.provider === providerGroup.value);
              const standaloneKeysForProvider = userApiKeys.filter(key => key.provider === providerGroup.value && !key.group_id);

              const filteredGroups = groupsForProvider.filter(group => 
                group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (group.model_name && getModelLabel(group.model_name, userApiKeys, aiKeyGroups).toLowerCase().includes(searchTerm.toLowerCase()))
              );

              const filteredStandaloneKeys = standaloneKeysForProvider.filter(key => 
                (key.nickname && key.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (key.model_name && getModelLabel(key.model_name, userApiKeys, aiKeyGroups).toLowerCase().includes(searchTerm.toLowerCase()))
              );

              const hasAnyContent = filteredGroups.length > 0 || filteredStandaloneKeys.length > 0;

              if (!hasAnyContent && !providerGroup.company.toLowerCase().includes(searchTerm.toLowerCase())) {
                return null;
              }

              return (
                <React.Fragment key={providerGroup.value}>
                  <DropdownMenuLabel className={cn("flex items-center gap-2 font-bold text-foreground px-2 py-1.5", !hasAnyContent && "text-muted-foreground")}>
                    <span>{providerGroup.company}</span>
                    <providerGroup.logo className="h-4 w-4" />
                  </DropdownMenuLabel>
                  {hasAnyContent ? (
                    <>
                      {/* Special rendering for Google Gemini: Only show groups */}
                      {providerGroup.value === 'google_gemini' && filteredGroups.map(group => {
                        const activeKeysCount = group.api_keys?.filter(k => k.status === 'active').length || 0;
                        const isDisabled = isLoading || activeKeysCount === 0;
                        return (
                          <DropdownMenuItem
                            key={group.id}
                            onClick={() => onModelChange(`group:${group.id}`)}
                            className={cn("flex items-center justify-between cursor-pointer pl-8", selectedModel === `group:${group.id}` && "bg-accent text-accent-foreground", isDisabled && "opacity-50 cursor-not-allowed")}
                            disabled={isDisabled}
                          >
                            <span className="flex items-center gap-2">
                              {group.name}
                            </span>
                            {selectedModel === `group:${group.id}` && <Check className="h-4 w-4 text-green-500" />}
                          </DropdownMenuItem>
                        );
                      })}

                      {/* Default rendering for other providers like custom_endpoint */}
                      {providerGroup.value !== 'google_gemini' && (
                        <>
                          {filteredGroups.map(group => {
                            const activeKeysCount = group.api_keys?.filter(k => k.status === 'active').length || 0;
                            const isDisabled = isLoading || activeKeysCount === 0;
                            return (
                              <DropdownMenuItem
                                key={group.id}
                                onClick={() => onModelChange(`group:${group.id}`)}
                                className={cn("flex items-center justify-between cursor-pointer pl-8", selectedModel === `group:${group.id}` && "bg-accent text-accent-foreground", isDisabled && "opacity-50 cursor-not-allowed")}
                                disabled={isDisabled}
                              >
                                <span className="flex items-center gap-2">
                                  <Folder className="h-4 w-4" />
                                  {group.name} ({activeKeysCount} activas)
                                </span>
                                {selectedModel === `group:${group.id}` && <Check className="h-4 w-4 text-green-500" />}
                              </DropdownMenuItem>
                            );
                          })}
                          {filteredStandaloneKeys.map(key => {
                            const itemValue = `user_key:${key.id}`;
                            const isDisabledKey = isLoading || key.status !== 'active';
                            return (
                              <DropdownMenuItem
                                key={key.id}
                                onClick={() => onModelChange(itemValue)}
                                className={cn("flex items-center justify-between cursor-pointer pl-8", selectedModel === itemValue && "bg-accent text-accent-foreground", isDisabledKey && "opacity-50 cursor-not-allowed")}
                                disabled={isDisabledKey}
                              >
                                <span className="flex items-center gap-1">
                                  {renderStatusIcon(key.status)}
                                  {key.nickname || getModelLabel(key.model_name ?? undefined, userApiKeys, aiKeyGroups)}
                                  {key.is_global && ' (Global)'}
                                </span>
                                {selectedModel === itemValue && <Check className="h-4 w-4 text-green-500" />}
                              </DropdownMenuItem>
                            );
                          })}
                        </>
                      )}
                    </>
                  ) : (
                    <DropdownMenuItem disabled className="pl-8 cursor-not-allowed text-muted-foreground">
                      No hay claves o grupos configurados.
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