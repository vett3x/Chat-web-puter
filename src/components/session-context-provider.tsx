"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SUPERUSER_EMAILS, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada
import { toast } from 'sonner'; // Import toast

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
    console.log("[SessionContext] fetchUserProfileAndRole called with session:", currentSession?.user?.id);
    if (currentSession?.user?.id) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, permissions') // Select permissions
        .eq('id', currentSession.user.id)
        .single();

      let determinedRole: UserRole | null = null;
      let determinedPermissions: UserPermissions = {};

      if (error) {
        console.error('[SessionContext] Error fetching user profile role and permissions:', error);
        // Fallback to email check if profile fetch fails
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
      } else if (profile) {
        console.log("[SessionContext] Profile fetched:", profile);
        determinedRole = profile.role as UserRole;
        determinedPermissions = profile.permissions || {};
      } else {
        // Fallback if profile not found (shouldn't happen with trigger)
        console.log("[SessionContext] Profile not found, falling back to email check.");
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
      }

      // Explicitly set all permissions to true if the determined role is super_admin
      if (determinedRole === 'super_admin') {
        determinedPermissions = {}; // Reset to ensure all are set
        for (const key of Object.values(PERMISSION_KEYS)) {
          determinedPermissions[key] = true;
        }
      } else if (!profile) { // If no profile and not super_admin by email, set default user permissions
        determinedPermissions = {
          can_create_server: false,
          can_manage_docker_containers: false,
          can_manage_cloudflare_domains: false,
          can_manage_cloudflare_tunnels: false,
        };
      }
      
      setUserRole(determinedRole);
      setUserPermissions(determinedPermissions);

    } else {
      console.log("[SessionContext] No current session for profile fetch.");
      setUserRole(null);
      setUserPermissions({});
    }
  };

  useEffect(() => {
    console.log("[SessionContext] useEffect started.");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[SessionContext] onAuthStateChange event: ${event}, session: ${currentSession?.user?.id}`);
      setSession(currentSession);
      setIsLoading(false); // This is important: set to false after auth state change
      await fetchUserProfileAndRole(currentSession);

      if (event === 'SIGNED_OUT' || !currentSession) {
        if (pathname !== '/login') {
          console.log("[SessionContext] Redirecting to /login due to SIGNED_OUT or no session.");
          router.push('/login');
        }
      } else if (currentSession) {
        if (pathname === '/login') {
          console.log("[SessionContext] Redirecting to / due to active session on /login page.");
          router.push('/');
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log(`[SessionContext] getSession().then() resolved. Initial session: ${initialSession?.user?.id}`);
      setSession(initialSession);
      setIsLoading(false); // This is also important: set to false after initial session load
      await fetchUserProfileAndRole(initialSession);

      if (!initialSession && pathname !== '/login') {
        console.log("[SessionContext] Redirecting to /login due to no initial session.");
        router.push('/login');
      } else if (initialSession && pathname === '/login') {
        console.log("[SessionContext] Redirecting to / due to initial active session on /login page.");
        router.push('/');
      }
    }).catch(error => {
      console.error("[SessionContext] Error in getSession():", error);
      setIsLoading(false); // Ensure loading is false even on error
      toast.error("Error al cargar la sesión: " + error.message);
    });

    return () => {
      console.log("[SessionContext] useEffect cleanup.");
      subscription.unsubscribe();
    };
  }, [router, pathname]); // Dependencies look correct

  if (isLoading) {
    console.log("[SessionContext] Rendering loading state.");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }
  console.log("[SessionContext] Rendering children.");
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