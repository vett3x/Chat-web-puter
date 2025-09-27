"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SUPERUSER_EMAILS, PERMISSION_KEYS } from '@/lib/constants';
import { toast } from 'sonner';

type UserRole = 'user' | 'admin' | 'super_admin';
type UserStatus = 'active' | 'banned' | 'kicked'; // NEW: Define UserStatus type
type UserPermissions = Record<string, boolean>;

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  userRole: UserRole | null;
  userPermissions: UserPermissions;
  userAvatarUrl: string | null;
  userLanguage: string | null;
  userStatus: UserStatus | null; // NEW: Add userStatus to context
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({});
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userLanguage, setUserLanguage] = useState<string | null>('es');
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null); // NEW: State for user status
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserProfileAndRole = async (currentSession: Session | null) => {
    if (currentSession?.user?.id) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, permissions, avatar_url, language, status, kicked_at') // NEW: Select kicked_at
        .eq('id', currentSession.user.id)
        .single();

      let determinedRole: UserRole | null = null;
      let determinedPermissions: UserPermissions = {};
      let determinedAvatarUrl: string | null = null;
      let determinedLanguage: string | null = 'es';
      let determinedStatus: UserStatus = 'active'; // Default to active
      let determinedKickedAt: string | null = null; // NEW: For kicked_at

      if (error) {
        console.error('[SessionContext] Error fetching user profile:', error);
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
      } else if (profile) {
        determinedRole = profile.role as UserRole;
        determinedPermissions = profile.permissions || {};
        determinedAvatarUrl = profile.avatar_url;
        determinedLanguage = profile.language || 'es';
        determinedStatus = profile.status as UserStatus;
        determinedKickedAt = profile.kicked_at; // NEW: Assign fetched kicked_at
      } else {
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
      }

      if (determinedRole === 'super_admin') {
        determinedPermissions = {};
        for (const key of Object.values(PERMISSION_KEYS)) {
          determinedPermissions[key] = true;
        }
        determinedStatus = 'active'; // Super admins are always active
      } else if (!profile) {
        determinedPermissions = {
          can_create_server: false,
          can_manage_docker_containers: false,
          can_manage_cloudflare_domains: false,
          can_manage_cloudflare_tunnels: false,
        };
      }
      
      // NEW: Logic to auto-unkick if 15 minutes have passed
      if (determinedStatus === 'kicked' && determinedKickedAt) {
        const kickedTime = new Date(determinedKickedAt).getTime();
        const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
        if (kickedTime < fifteenMinutesAgo) {
          console.log(`[SessionContext] User ${currentSession.user.id} was kicked, but 15 minutes have passed. Auto-unkicking.`);
          await supabase.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', currentSession.user.id);
          await supabase.auth.admin.updateUserById(currentSession.user.id, { user_metadata: { kicked_at: null } });
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

  // Real-time status check to kick users if their role is disabled or session is invalidated
  useEffect(() => {
    const checkSessionAndGlobalStatus = async () => {
      if (!session) return;

      console.log(`[SessionContext] Real-time status check for user ${session.user.id}. Current role: ${userRole}, status: ${userStatus}`);

      // 1. Primary Check: Force a token refresh to see if the session was invalidated on the server.
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !data.session) {
        console.warn("[SessionContext] Session refresh failed or returned null session. Signing out.", refreshError?.message);
        await supabase.auth.signOut();
        toast.error("Tu sesión ha sido invalidada por un administrador o ha expirado.");
        return;
      }

      // 2. Secondary Check: Is the user's role globally disabled or is their profile status 'banned'/'kicked'? (Only for non-super-admins)
      if (userRole !== 'super_admin') {
        try {
          const response = await fetch('/api/settings/public-status');
          if (!response.ok) {
            console.warn('Could not fetch public status for real-time check.');
            return;
          }
          const statusData = await response.json();
          const { usersDisabled, adminsDisabled } = statusData;

          // Re-fetch profile status to ensure it's up-to-date
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('status, kicked_at') // NEW: Select kicked_at
            .eq('id', session.user.id)
            .single();

          if (profileError || !profile) {
            console.error("[SessionContext] Error re-fetching user profile status:", profileError);
            setUserStatus('active'); 
          } else {
            setUserStatus(profile.status as UserStatus);
            // NEW: Auto-unkick logic here as well for real-time checks
            if (profile.status === 'kicked' && profile.kicked_at) {
              const kickedTime = new Date(profile.kicked_at).getTime();
              const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
              if (kickedTime < fifteenMinutesAgo) {
                console.log(`[SessionContext] Real-time check: User ${session.user.id} was kicked, but 15 minutes have passed. Auto-unkicking.`);
                await supabase.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', session.user.id);
                await supabase.auth.admin.updateUserById(session.user.id, { user_metadata: { kicked_at: null } });
                setUserStatus('active');
                toast.info("Tu expulsión ha expirado. Puedes volver a usar la aplicación.");
                return; // Exit early as status changed
              }
            }

            if (profile.status === 'banned' || profile.status === 'kicked') {
              console.log(`[SessionContext] Real-time check: User ${session.user.id} is ${profile.status}. Signing out.`);
              await supabase.auth.signOut();
              toast.error(`Tu cuenta ha sido ${profile.status === 'banned' ? 'baneada' : 'expulsada'}. Se ha cerrado tu sesión.`);
              return;
            }
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

    const intervalId = setInterval(checkSessionAndGlobalStatus, 3000); // Check every 3 seconds

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
    <SessionContext.Provider value={{ session, isLoading, userRole, userPermissions, userAvatarUrl, userLanguage, userStatus }}>
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