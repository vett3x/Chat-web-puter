"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SUPERUSER_EMAILS } from '@/lib/constants'; // Importación actualizada

type UserRole = 'user' | 'admin' | 'super_admin';
type UserPermissions = Record<string, boolean>; // Define type for permissions

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  userRole: UserRole | null;
  userPermissions: UserPermissions; // Add userPermissions to context
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({}); // State for userPermissions
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserProfileAndRole = async (currentSession: Session | null) => {
    if (currentSession?.user?.id) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, permissions') // Select permissions
        .eq('id', currentSession.user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile role and permissions:', error);
        setUserRole(null);
        setUserPermissions({});
      } else if (profile) {
        setUserRole(profile.role as UserRole);
        setUserPermissions(profile.permissions || {});
      } else {
        // Fallback if profile not found (shouldn't happen with trigger)
        const fallbackRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
        setUserRole(fallbackRole);
        // Assign default permissions for fallback
        if (fallbackRole === 'super_admin') {
          setUserPermissions({
            can_create_server: true,
            can_manage_docker_containers: true,
            can_manage_cloudflare_domains: true,
            can_manage_cloudflare_tunnels: true,
          });
        } else { // Default for 'user' and 'admin' fallback if profile not found
          setUserPermissions({
            can_create_server: false,
            can_manage_docker_containers: false,
            can_manage_cloudflare_domains: false,
            can_manage_cloudflare_tunnels: false,
          });
        }
      }
    } else {
      setUserRole(null);
      setUserPermissions({});
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      setIsLoading(false);
      await fetchUserProfileAndRole(currentSession); // Fetch role and permissions on auth state change

      if (event === 'SIGNED_OUT' || !currentSession) {
        if (pathname !== '/login') {
          router.push('/login');
        }
      } else if (currentSession) {
        if (pathname === '/login') {
          router.push('/');
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setIsLoading(false);
      await fetchUserProfileAndRole(initialSession); // Fetch role and permissions on initial session load

      if (!initialSession && pathname !== '/login') {
        router.push('/login');
      } else if (initialSession && pathname === '/login') {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ session, isLoading, userRole, userPermissions }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};