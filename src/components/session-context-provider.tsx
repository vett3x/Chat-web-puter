"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SUPERUSER_EMAILS, PERMISSION_KEYS } from '@/lib/constants';
import { toast } from 'sonner';

type UserRole = 'user' | 'admin' | 'super_admin';
type UserPermissions = Record<string, boolean>;

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  userRole: UserRole | null;
  userPermissions: UserPermissions;
  userAvatarUrl: string | null;
  userLanguage: string | null; // NEW: Add userLanguage to context
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({});
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userLanguage, setUserLanguage] = useState<string | null>('es'); // NEW: State for userLanguage, default to 'es'
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserProfileAndRole = async (currentSession: Session | null) => {
    console.log("[SessionContext] fetchUserProfileAndRole called with session:", currentSession?.user?.id);
    if (currentSession?.user?.id) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, permissions, avatar_url, language') // NEW: Select language
        .eq('id', currentSession.user.id)
        .single();

      let determinedRole: UserRole | null = null;
      let determinedPermissions: UserPermissions = {};
      let determinedAvatarUrl: string | null = null;
      let determinedLanguage: string | null = 'es'; // NEW: Variable for language, default to 'es'

      if (error) {
        console.error('[SessionContext] Error fetching user profile:', error);
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
      } else if (profile) {
        console.log("[SessionContext] Profile fetched:", profile);
        determinedRole = profile.role as UserRole;
        determinedPermissions = profile.permissions || {};
        determinedAvatarUrl = profile.avatar_url;
        determinedLanguage = profile.language || 'es'; // NEW: Set language, fallback to 'es'
      } else {
        console.log("[SessionContext] Profile not found, falling back to email check.");
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
      }

      if (determinedRole === 'super_admin') {
        determinedPermissions = {};
        for (const key of Object.values(PERMISSION_KEYS)) {
          determinedPermissions[key] = true;
        }
      } else if (!profile) {
        determinedPermissions = {
          can_create_server: false,
          can_manage_docker_containers: false,
          can_manage_cloudflare_domains: false,
          can_manage_cloudflare_tunnels: false,
        };
      }
      
      setUserRole(determinedRole);
      setUserPermissions(determinedPermissions);
      setUserAvatarUrl(determinedAvatarUrl);
      setUserLanguage(determinedLanguage); // NEW: Set user language state

    } else {
      console.log("[SessionContext] No current session for profile fetch.");
      setUserRole(null);
      setUserPermissions({});
      setUserAvatarUrl(null);
      setUserLanguage('es'); // NEW: Clear language
    }
  };

  useEffect(() => {
    console.log("[SessionContext] useEffect started.");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[SessionContext] onAuthStateChange event: ${event}, session: ${currentSession?.user?.id}`);
      setSession(currentSession);
      setIsLoading(false);
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
      setIsLoading(false);
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
      setIsLoading(false);
      toast.error("Error al cargar la sesión: " + error.message);
    });

    return () => {
      console.log("[SessionContext] useEffect cleanup.");
      subscription.unsubscribe();
    };
  }, [router, pathname]);

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
    <SessionContext.Provider value={{ session, isLoading, userRole, userPermissions, userAvatarUrl, userLanguage }}>
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