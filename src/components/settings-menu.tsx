"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Server, Users, KeyRound, GitPullRequest, ShieldAlert } from 'lucide-react';
import { useSession } from '@/components/session-context-provider';

interface SettingsMenuProps {
  onOpenAdminPanel: () => void;
  onOpenUserManagement: () => void;
  onOpenApiManagement: () => void;
  onOpenUpdateManager: () => void;
  onOpenAlerts: () => void;
  hasNewCriticalAlerts: boolean;
  hasNewErrorTickets: boolean;
}

export function SettingsMenu({
  onOpenAdminPanel,
  onOpenUserManagement,
  onOpenApiManagement,
  onOpenUpdateManager,
  onOpenAlerts,
  hasNewCriticalAlerts,
  hasNewErrorTickets,
}: SettingsMenuProps) {
  const { userRole } = useSession();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  if (!isAdmin) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full h-7 w-7"
          title="Configuración y Administración"
        >
          {(hasNewCriticalAlerts || hasNewErrorTickets) && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Administración</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenAdminPanel} className="cursor-pointer">
          <Server className="mr-2 h-4 w-4" />
          <span>Panel de Administración</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenUserManagement} className="cursor-pointer">
          <Users className="mr-2 h-4 w-4" />
          <span>Gestión de Usuarios</span>
          {hasNewErrorTickets && <span className="ml-auto w-2 h-2 rounded-full bg-red-500" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Configuración</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenApiManagement} className="cursor-pointer">
          <KeyRound className="mr-2 h-4 w-4" />
          <span>Gestión de API Keys</span>
        </DropdownMenuItem>
        {isSuperAdmin && (
          <DropdownMenuItem onClick={onOpenUpdateManager} className="cursor-pointer">
            <GitPullRequest className="mr-2 h-4 w-4" />
            <span>Gestión de Actualizaciones</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}