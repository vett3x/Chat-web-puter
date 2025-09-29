"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SUPERUSER_EMAILS, PERMISSION_KEYS } from '@/lib/constants';
import { toast } from 'sonner';
import { addMinutes } from 'date-fns'; // Import addMinutes

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

  const isUserTemporarilyDisabled = userStatus === 'banned' || userStatus === 'kicked';

  const fetchUserProfileAndRole = useCallback(async (currentSession: Session | null) => {
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
        determinedStatus = 'active'; // Super Admins are always active
      } else if (!profile) {
        determinedPermissions = {
          can_create_server: false,
          can_manage_docker_containers: false,
          can_manage_cloudflare_domains: false,
          can_manage_cloudflare_tunnels: false,
        };
      }
      
      // Client-side check for expired kick status
      if (determinedStatus === 'kicked' && determinedKickedAt) {
        const kickedTime = new Date(determinedKickedAt);
        const unkickTime = addMinutes(kickedTime, 15); // Assuming 15 minutes default kick duration
        const now = new Date();

        if (now >= unkickTime) {
          console.log(`[SessionContext] User ${currentSession.user.id} was kicked, but 15 minutes have passed. Auto-unkicking locally.`);
          // Optimistically update local state. Middleware/cron will handle DB update.
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
  }, []);

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
  }, [router, pathname, fetchUserProfileAndRole]);

  useEffect(() => {
    const checkSessionAndGlobalStatus = async () => {
      if (!session || !session.user.id) return;

      console.log(`[SessionContext] Real-time status check for user ${session.user.id}. Current role: ${userRole}, status: ${userStatus}`);

      // Fetch global settings
      try {
        const response = await fetch('/api/settings/public-status');
        if (!response.ok) {
          console.warn('Could not fetch public status for real-time check.');
          return;
        }
        const statusData = await response.json();
        const { usersDisabled, adminsDisabled } = statusData;

        // Fetch user's current profile status from DB
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, kicked_at')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          console.error("[SessionContext] Error re-fetching user profile status:", profileError);
          // If profile not found, assume active for now, but log out if global settings disable their role
          if (userRole !== 'super_admin') {
            if (usersDisabled && userRole === 'user') {
              console.log(`[SessionContext] Real-time check: User ${session.user.id} (role: user) is disabled globally. Signing out.`);
              await supabase.auth.signOut();
              toast.error("El acceso para cuentas de Usuario ha sido desactivado. Se ha cerrado tu sesión.");
              router.push('/login?error=account_type_disabled');
              return;
            } else if (adminsDisabled && userRole === 'admin') {
              console.log(`[SessionContext] Real-time check: User ${session.user.id} (role: admin) is disabled globally. Signing out.`);
              await supabase.auth.signOut();
              toast.error("El acceso para cuentas de Admin ha sido desactivado. Se ha cerrado tu sesión.");
              router.push('/login?error=account_type_disabled');
              return;
            }
          }
          return; // Exit if profile not found and no global disable
        }

        const dbStatus = profile.status as UserStatus;
        const dbKickedAt = profile.kicked_at;

        // Handle global role disable (only for non-super_admin)
        if (userRole !== 'super_admin') {
          if (usersDisabled && userRole === 'user') {
            console.log(`[SessionContext] Real-time check: User ${session.user.id} (role: user) is disabled globally. Signing out.`);
            await supabase.auth.signOut();
            toast.error("El acceso para cuentas de Usuario ha sido desactivado. Se ha cerrado tu sesión.");
            router.push('/login?error=account_type_disabled');
            return;
          } else if (adminsDisabled && userRole === 'admin') {
            console.log(`[SessionContext] Real-time check: User ${session.user.id} (role: admin) is disabled globally. Signing out.`);
            await supabase.auth.signOut();
            toast.error("El acceso para cuentas de Admin ha sido desactivado. Se ha cerrado tu sesión.");
            router.push('/login?error=account_type_disabled');
            return;
          }
        }

        // Handle individual user status changes (banned/kicked)
        if (dbStatus === 'banned' && userStatus !== 'banned') {
          console.log(`[SessionContext] Real-time check: User ${session.user.id} is now banned. Signing out.`);
          await supabase.auth.signOut();
          toast.error("Tu cuenta ha sido baneada. Se ha cerrado tu sesión.");
          router.push('/login?error=account_banned');
          return;
        }

        if (dbStatus === 'kicked' && userStatus !== 'kicked') {
          const kickedTime = dbKickedAt ? new Date(dbKickedAt).getTime() : 0;
          const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
          if (kickedTime > fifteenMinutesAgo) { // Still actively kicked
            console.log(`[SessionContext] Real-time check: User ${session.user.id} is now kicked. Signing out.`);
            await supabase.auth.signOut();
            toast.warning("Has sido expulsado del sistema. Se ha cerrado tu sesión.");
            router.push(`/login?error=account_kicked&kicked_at=${dbKickedAt}`);
            return;
          } else {
            // If DB says kicked but time has expired, update DB to active
            console.log(`[SessionContext] Real-time check: User ${session.user.id} was kicked, but 15 minutes have passed. Auto-unkicking in DB.`);
            await supabase.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', session.user.id);
            // For client-side, optimistically update local state
            setUserStatus('active');
            toast.info("Tu expulsión ha expirado. Puedes volver a usar la aplicación.");
          }
        }
        
        // If status is active in DB but local state was banned/kicked, update local state
        if (dbStatus === 'active' && (userStatus === 'banned' || userStatus === 'kicked')) {
            console.log(`[SessionContext] Real-time check: User ${session.user.id} is now active in DB. Updating local state.`);
            setUserStatus('active');
            toast.info("Tu cuenta ha sido reactivada.");
        }

        // If there's any discrepancy in status or kicked_at, re-fetch full profile to synchronize all state
        if (dbStatus !== userStatus || (dbKickedAt && dbKickedAt !== profile.kicked_at) || (!dbKickedAt && profile.kicked_at)) {
            console.log(`[SessionContext] Real-time check: Profile data discrepancy detected. Re-fetching full profile for user ${session.user.id}.`);
            await fetchUserProfileAndRole(session);
        }

      } catch (error) {
        console.error("Error checking global status in real-time:", error);
      }
    };

    // Set interval for 10 seconds
    const intervalId = setInterval(checkSessionAndGlobalStatus, 10000);

    return () => clearInterval(intervalId);
  }, [session, userRole, userStatus, router, fetchUserProfileAndRole]);

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