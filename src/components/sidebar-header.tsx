"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Folder, Server, Users, Wand2 } from 'lucide-react';
import { ProfileDropdown } from './profile-dropdown';
import { useSession } from './session-context-provider';

interface SidebarHeaderProps {
  onNewConversation: () => void;
  onNewFolder: (parentId?: string | null) => void;
  isCreatingConversation: boolean;
  isCreatingFolder: boolean;
  onOpenProfileSettings: () => void;
  onOpenAppSettings: () => void;
  onOpenServerManagement: () => void;
  onOpenUserManagement: () => void;
  onOpenDeepAiCoder: () => void;
}

export function SidebarHeader({
  onNewConversation,
  onNewFolder,
  isCreatingConversation,
  isCreatingFolder,
  onOpenProfileSettings,
  onOpenAppSettings,
  onOpenServerManagement,
  onOpenUserManagement,
  onOpenDeepAiCoder,
}: SidebarHeaderProps) {
  const { userRole } = useSession();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  return (
    <>
      <div className="mb-4">
        <ProfileDropdown
          onOpenProfileSettings={onOpenProfileSettings}
          onOpenAppSettings={onOpenAppSettings}
          onOpenServerManagement={onOpenServerManagement}
          onOpenUserManagement={onOpenUserManagement}
        />
      </div>
      <div className="flex items-center justify-center mb-4">
        <div className="flex gap-2">
          <Button
            variant="default"
            size="icon"
            onClick={onOpenDeepAiCoder}
            className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white animate-pulse-purple rounded-full h-7 w-7"
            title="DeepAI Coder"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={onNewConversation}
            disabled={isCreatingConversation}
            className="bg-green-500 hover:bg-green-600 text-white animate-pulse-glow rounded-full h-7 w-7"
            title="Nueva conversación"
          >
            {isCreatingConversation ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNewFolder()}
            disabled={isCreatingFolder}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full h-7 w-7"
            title="Nueva carpeta"
          >
            {isCreatingFolder ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Folder className="h-3.5 w-3.5" />
            )}
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={onOpenServerManagement}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full h-7 w-7"
              title="Gestión de Servidores"
            >
              <Server className="h-3.5 w-3.5" />
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={onOpenUserManagement}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full h-7 w-7"
              title="Gestión de Usuarios"
            >
              <Users className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}