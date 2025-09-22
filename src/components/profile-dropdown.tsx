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
import { Moon, Sun, Settings, LogOut, User as UserIcon, Server, Users, Crown, Shield, Bot } from 'lucide-react'; // Import Bot icon
import { useTheme } from 'next-themes';
import { useSession } from '@/components/session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Profile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface ProfileDropdownProps {
  onOpenProfileSettings: () => void;
  onOpenAppSettings: () => void;
  onOpenServerManagement: () => void;
  onOpenUserManagement: () => void; // New prop for user management
}

export function ProfileDropdown({ onOpenProfileSettings, onOpenAppSettings, onOpenServerManagement, onOpenUserManagement }: ProfileDropdownProps) {
  const { session, userRole } = useSession(); // Changed isSuperUser to userRole
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
    return null; // No mostrar el dropdown si no hay sesión
  }

  const isAdmin = userRole === 'admin' || userRole === 'super_admin'; // Helper for admin access

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start p-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 mr-2">
            {profile?.avatar_url && profile.avatar_url !== '' ? ( // Updated condition
              <AvatarImage src={profile.avatar_url} alt="Avatar" />
            ) : (
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                <Bot className="h-4 w-4" /> {/* Changed to Bot icon */}
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
            {userRole && userRole !== 'user' && ( // Only show role badge if not 'user'
              <span className={`flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full mt-1 capitalize
                ${userRole === 'super_admin' ? 'bg-yellow-500 text-yellow-900 dark:bg-yellow-400 dark:text-yellow-950' : ''}
                ${userRole === 'admin' ? 'bg-purple-500 text-purple-900 dark:bg-purple-400 dark:text-purple-950' : ''}
              `}>
                {userRole === 'super_admin' && <Crown className="h-3 w-3 fill-current" />}
                {userRole === 'admin' && <Shield className="h-3 w-3 fill-current" />}
                {userRole === 'super_admin' ? 'Super Admin' : userRole}
              </span>
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
          onSelect={(e: Event) => e.preventDefault()} // Prevenir que el menú se cierre al interactuar con el switch
        >
          <div className="flex items-center">
            {isMounted && theme === 'dark' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
            <span>Modo Oscuro</span>
          </div>
          {isMounted && (
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              onClick={(e) => e.stopPropagation()} // Asegurar que el clic del switch no propague
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenAppSettings} className="flex items-center cursor-pointer">
          <div className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuración</span>
          </div>
        </DropdownMenuItem>
        {isAdmin && ( // Show Server Management for Admins and Super Admins
          <DropdownMenuItem onClick={onOpenServerManagement} className="flex items-center cursor-pointer">
            <div className="flex items-center">
              <Server className="mr-2 h-4 w-4" />
              <span>Gestión de Servidores</span>
            </div>
          </DropdownMenuItem>
        )}
        {isAdmin && ( // Show User Management for Admins and Super Admins
          <DropdownMenuItem onClick={onOpenUserManagement} className="flex items-center cursor-pointer">
            <div className="flex items-center">
              <Users className="mr-2 h-4 w-4" />
              <span>Gestión de Usuarios</span>
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