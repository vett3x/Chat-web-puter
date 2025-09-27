"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SUPERUSER_EMAILS, PERMISSION_KEYS } from '@/lib/constants';
import { toast } from 'sonner';

type UserRole = 'user' | 'admin' | 'super_admin';
type UserStatus = 'active' | 'banned' | 'kicked';
type UserPermissions = Record<string, boolean>;

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  userRole: UserRole | null;
  userPermissions: UserPermissions;
  userAvatarUrl: string | null;
  userLanguage: string | null;
  userStatus: UserStatus | null;
  isUserTemporarilyDisabled: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({});
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userLanguage, setUserLanguage] = useState<string | null>('es');
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // DERIVED STATE: This is the fix. isUserTemporarilyDisabled is now derived directly from userStatus.
  const isUserTemporarilyDisabled = userStatus === 'banned' || userStatus === 'kicked';

  const fetchUserProfileAndRole = async (currentSession: Session | null) => {
    if (currentSession?.user?.id) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, permissions, avatar_url, language, status, kicked_at')
        .eq('id', currentSession.user.id)
        .single();

      let determinedRole: UserRole | null = null;
      let determinedPermissions: UserPermissions = {};
      let determinedAvatarUrl: string | null = null;
      let determinedLanguage: string | null = 'es';
      let determinedStatus: UserStatus = 'active';
      let determinedKickedAt: string | null = null;

      if (error) {
        console.error('[SessionContext] Error fetching user profile:', error);
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
      } else if (profile) {
        determinedRole = profile.role as UserRole;
        determinedPermissions = profile.permissions || {};
        determinedAvatarUrl = profile.avatar_url;
        determinedLanguage = profile.language || 'es';
        determinedStatus = profile.status as UserStatus;
        determinedKickedAt = profile.kicked_at;
      } else {
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
      }

      if (determinedRole === 'super_admin') {
        determinedPermissions = {};
        for (const key of Object.values(PERMISSION_KEYS)) {
          determinedPermissions[key] = true;
        }
        determinedStatus = 'active';
      } else if (!profile) {
        determinedPermissions = {
          can_create_server: false,
          can_manage_docker_containers: false,
          can_manage_cloudflare_domains: false,
          can_manage_cloudflare_tunnels: false,
        };
      }
      
      if (determinedStatus === 'kicked' && determinedKickedAt) {
        const kickedTime = new Date(determinedKickedAt).getTime();
        const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
        if (kickedTime < fifteenMinutesAgo) {
          console.log(`[SessionContext] User ${currentSession.user.id} was kicked, but 15 minutes have passed. Auto-unkicking.`);
          await supabase.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', currentSession.user.id);
          // This part requires an admin client, so we'll rely on the server-side cron/middleware to handle it.
          // For the client, we can optimistically set the status to active.
          determinedStatus = 'active';
          determinedKickedAt = null;
          toast.info("Tu expulsión ha expirado. Puedes volver a usar la aplicación.");
        }
      }

      setUserRole(determinedRole);
      setUserPermissions(determinedPermissions);
      setUserAvatarUrl(determinedAvatarUrl);
      setUserLanguage(determinedLanguage);
      setUserStatus(determinedStatus);

    } else {
      setUserRole(null);
      setUserPermissions({});
      setUserAvatarUrl(null);
      setUserLanguage('es');
      setUserStatus(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[SessionContext] Auth state changed: ${event}`);
      setSession(currentSession);
      await fetchUserProfileAndRole(currentSession);
      setIsLoading(false);

      if (event === 'SIGNED_OUT' || !currentSession) {
        if (pathname !== '/login') {
          console.log('[SessionContext] Redirecting to /login due to SIGNED_OUT or no session.');
          router.push('/login');
        }
      } else if (currentSession) {
        if (pathname === '/login') {
          console.log('[SessionContext] Redirecting to / from /login due to active session.');
          router.push('/');
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('[SessionContext] Initial session check.');
      setSession(initialSession);
      await fetchUserProfileAndRole(initialSession);
      setIsLoading(false);

      if (!initialSession && pathname !== '/login') {
        console.log('[SessionContext] Initial: No session, redirecting to /login.');
        router.push('/login');
      } else if (initialSession && pathname === '/login') {
        console.log('[SessionContext] Initial: Session active on /login, redirecting to /.');
        router.push('/');
      }
    }).catch(error => {
      setIsLoading(false);
      toast.error("Error al cargar la sesión: " + error.message);
      console.error('[SessionContext] Error fetching initial session:', error);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  useEffect(() => {
    const checkSessionAndGlobalStatus = async () => {
      if (!session) return;

      console.log(`[SessionContext] Real-time status check for user ${session.user.id}. Current role: ${userRole}, status: ${userStatus}`);

      // REMOVED: The aggressive supabase.auth.refreshSession() call.
      // The Supabase client handles this automatically.

      if (userRole !== 'super_admin') {
        try {
          const response = await fetch('/api/settings/public-status');
          if (!response.ok) {
            console.warn('Could not fetch public status for real-time check.');
            return;
          }
          const statusData = await response.json();
          const { usersDisabled, adminsDisabled } = statusData;

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('status, kicked_at')
            .eq('id', session.user.id)
            .single();

          if (profileError || !profile) {
            console.error("[SessionContext] Error re-fetching user profile status:", profileError);
            setUserStatus('active'); 
          } else {
            let currentStatus = profile.status as UserStatus;
            if (profile.status === 'kicked' && profile.kicked_at) {
              const kickedTime = new Date(profile.kicked_at).getTime();
              const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
              if (kickedTime < fifteenMinutesAgo) {
                currentStatus = 'active';
              }
            }
            setUserStatus(currentStatus);
          }

          if (usersDisabled && userRole === 'user') {
            console.log(`[SessionContext] Real-time check: User ${session.user.id} (role: user) is disabled. Signing out.`);
            await supabase.auth.signOut();
            toast.error("El acceso para cuentas de Usuario ha sido desactivado. Se ha cerrado tu sesión.");
          } else if (adminsDisabled && userRole === 'admin') {
            console.log(`[SessionContext] Real-time check: User ${session.user.id} (role: admin) is disabled. Signing out.`);
            await supabase.auth.signOut();
            toast.error("El acceso para cuentas de Admin ha sido desactivado. Se ha cerrado tu sesión.");
          }
        } catch (error) {
          console.error("Error checking global status in real-time:", error);
        }
      }
    };

    const intervalId = setInterval(checkSessionAndGlobalStatus, 3000);

    return () => clearInterval(intervalId);
  }, [session, userRole, router, userStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }
  
  return (
    <SessionContext.Provider value={{ session, isLoading, userRole, userPermissions, userAvatarUrl, userLanguage, userStatus, isUserTemporarilyDisabled }}>
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