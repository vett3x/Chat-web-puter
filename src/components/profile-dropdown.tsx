"use client";

import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Moon, Sun, Settings, LogOut, User as UserIcon, Server, Users, Crown, Shield, Bot, GitPullRequest } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSession } from '@/components/session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Profile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface ProfileDropdownProps {
  onOpenProfileSettings: () => void;
  onOpenAppSettings: () => void;
  onOpenServerManagement: () => void;
  onOpenUserManagement: () => void;
  onOpenUpdateManager: () => void; // New prop for update manager
}

export function ProfileDropdown({ onOpenProfileSettings, onOpenAppSettings, onOpenServerManagement, onOpenUserManagement, onOpenUpdateManager }: ProfileDropdownProps) {
  const { session, userRole } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          toast.error('Error al cargar el perfil del usuario.');
        } else {
          setProfile(data);
        }
      }
    };

    fetchProfile();
  }, [session]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      toast.error('Error al cerrar sesión.');
    } else {
      toast.success('Sesión cerrada correctamente.');
      router.push('/login');
    }
  };

  const getInitials = (firstName: string | null | undefined, lastName: string | null | undefined) => {
    const first = firstName ? firstName.charAt(0) : '';
    const last = lastName ? lastName.charAt(0) : '';
    return (first + last).toUpperCase() || 'US';
  };

  if (!session) {
    return null;
  }

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin'; // Helper for super admin

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start p-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 mr-2">
            {profile?.avatar_url && profile.avatar_url !== '' ? (
              <AvatarImage src={profile.avatar_url} alt="Avatar" />
            ) : (
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex flex-col items-start overflow-hidden">
            <span className="text-sm font-medium truncate">
              {profile?.first_name || session.user.email?.split('@')[0] || 'Usuario'}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : session.user.email}
            </span>
            {userRole && userRole !== 'user' && (
              <Badge className={cn('capitalize mt-1', 
                userRole === 'super_admin' && 'bg-yellow-500 text-yellow-900 dark:bg-yellow-400 dark:text-yellow-950 border-transparent',
                userRole === 'admin' && 'bg-primary-light-purple text-white border-transparent'
              )}>
                {userRole === 'super_admin' && <Crown className="h-3 w-3 mr-1" />}
                {userRole === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                {userRole === 'super_admin' ? 'Super Admin' : userRole}
              </Badge>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-popover text-popover-foreground border-border">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Mi Cuenta</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem onClick={onOpenProfileSettings} className="flex items-center cursor-pointer">
          <div className="flex items-center">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onSelect={(e: Event) => e.preventDefault()}
        >
          <div className="flex items-center">
            {isMounted && theme === 'dark' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
            <span>Modo Oscuro</span>
          </div>
          {isMounted && (
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenAppSettings} className="flex items-center cursor-pointer">
          <div className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuración</span>
          </div>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={onOpenServerManagement} className="flex items-center cursor-pointer">
            <div className="flex items-center">
              <Server className="mr-2 h-4 w-4" />
              <span>Gestión de Servidores</span>
            </div>
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem onClick={onOpenUserManagement} className="flex items-center cursor-pointer">
            <div className="flex items-center">
              <Users className="mr-2 h-4 w-4" />
              <span>Gestión de Usuarios</span>
            </div>
          </DropdownMenuItem>
        )}
        {isSuperAdmin && ( // New item for Super Admins
          <DropdownMenuItem onClick={onOpenUpdateManager} className="flex items-center cursor-pointer">
            <div className="flex items-center">
              <GitPullRequest className="mr-2 h-4 w-4" />
              <span>Gestión de Actualizaciones</span>
            </div>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleSignOut}>
          <div className="flex items-center">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar Sesión</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}