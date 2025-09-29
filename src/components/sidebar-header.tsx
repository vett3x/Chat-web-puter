"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Folder, Server, Users, Wand2, FileText, ShieldAlert, KeyRound } from 'lucide-react';
import { ProfileDropdown } from './profile-dropdown';
import { useSession } from './session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SidebarHeaderProps {
  onNewConversation: () => void;
  onNewFolder: (parentId?: string | null) => void;
  onNewNote: () => void;
  isCreatingConversation: boolean;
  isCreatingFolder: boolean;
  isCreatingNote: boolean;
  onOpenProfileSettings: () => void;
  onOpenAppSettings: () => void;
  onOpenServerManagement: () => void;
  onOpenUserManagement: () => void;
  onOpenDeepAiCoder: () => void;
  onOpenUpdateManager: () => void;
  onOpenApiManagement: () => void;
  onOpenAlerts: () => void;
}

export function SidebarHeader({
  onNewConversation,
  onNewFolder,
  onNewNote,
  isCreatingConversation,
  isCreatingFolder,
  isCreatingNote,
  onOpenProfileSettings,
  onOpenAppSettings,
  onOpenServerManagement,
  onOpenUserManagement,
  onOpenDeepAiCoder,
  onOpenUpdateManager,
  onOpenApiManagement,
  onOpenAlerts,
}: SidebarHeaderProps) {
  const { userRole } = useSession();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const [hasNewErrorTickets, setHasNewErrorTickets] = useState(false);
  const [hasNewCriticalAlerts, setHasNewCriticalAlerts] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const errorTicketsChannel = supabase
      .channel('error-tickets-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'error_tickets' },
        (payload) => {
          console.log('New error ticket received:', payload.new);
          setHasNewErrorTickets(true);
          toast.warning('Nuevo ticket de error de usuario registrado.', {
            description: 'Un usuario ha encontrado un error con la IA. Revisa la gestión de usuarios para más detalles.',
          });
        }
      )
      .subscribe();

    const CRITICAL_EVENT_TYPES = [
      'command_blocked', 'server_add_failed', 'server_delete_failed',
      'container_create_failed', 'container_delete_failed', 'tunnel_create_failed',
      'tunnel_delete_failed', 'npm_install_failed', 'app_recovery_failed',
      'user_create_failed', 'user_delete_failed', 'user_role_update_failed',
      'user_permissions_update_failed',
    ];

    const criticalAlertsChannel = supabase
      .channel('critical-alerts-channel')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'server_events_log',
          filter: `event_type=in.(${CRITICAL_EVENT_TYPES.map(e => `'${e}'`).join(',')})`
        },
        (payload) => {
          console.log('New critical alert received:', payload.new);
          setHasNewCriticalAlerts(true);
          toast.error('¡Alerta Crítica del Sistema!', {
            description: `Evento: ${payload.new.event_type}. Revisa el panel de alertas para más detalles.`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(errorTicketsChannel);
      supabase.removeChannel(criticalAlertsChannel);
    };
  }, [isAdmin]);

  const handleOpenUserManagementAndClearNotification = () => {
    setHasNewErrorTickets(false);
    onOpenUserManagement();
  };

  const handleOpenAlertsAndClearNotification = () => {
    setHasNewCriticalAlerts(false);
    onOpenAlerts();
  };

  return (
    <>
      <div className="mb-4">
        <ProfileDropdown
          onOpenProfileSettings={onOpenProfileSettings}
          onOpenAppSettings={onOpenAppSettings}
          onOpenServerManagement={onOpenServerManagement}
          onOpenUserManagement={onOpenUserManagement}
          onOpenUpdateManager={onOpenUpdateManager}
          onOpenApiManagement={onOpenApiManagement}
        />
      </div>
      <div className="flex items-center justify-center mb-4">
        <div className="flex flex-wrap justify-center gap-2">
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
            onClick={onNewNote}
            disabled={isCreatingNote}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full h-7 w-7"
            title="Nueva nota"
          >
            {isCreatingNote ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
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
          {/* Always show API Management button */}
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenApiManagement}
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full h-7 w-7"
            title="Gestión de API Keys"
          >
            <KeyRound className="h-3.5 w-3.5" />
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
              onClick={handleOpenUserManagementAndClearNotification}
              className="relative text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full h-7 w-7"
              title="Gestión de Usuarios"
            >
              {hasNewErrorTickets && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
              <Users className="h-3.5 w-3.5" />
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleOpenAlertsAndClearNotification}
              className="relative text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full h-7 w-7"
              title="Alertas Críticas"
            >
              {hasNewCriticalAlerts && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
              <ShieldAlert className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}