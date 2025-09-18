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
import { Moon, Sun, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSession } from '@/components/session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
// No longer importing Link as we're using a dialog

interface Profile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface ProfileDropdownProps {
  onOpenProfileSettings: () => void; // Prop para abrir el diálogo de perfil
  onOpenAppSettings: () => void; // Nueva prop para abrir el diálogo de configuración de la app
}

export function ProfileDropdown({ onOpenProfileSettings, onOpenAppSettings }: ProfileDropdownProps) {
  const { session } = useSession();
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start p-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 mr-2">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt="Avatar" />
            ) : (
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                {getInitials(profile?.first_name, profile?.last_name)}
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