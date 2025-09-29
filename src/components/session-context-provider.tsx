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
  triggerGlobalRefresh: () => void; // NEW: Expose a function to trigger global refresh
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children, onGlobalRefresh }: { children: React.ReactNode; onGlobalRefresh?: () => void }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({});
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userLanguage, setUserLanguage] = useState<string | null>('es');
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // NEW: State to track last known global settings and user profile status
  const [lastKnownGlobalSettings, setLastKnownGlobalSettings] = useState<{
    maintenance_mode_enabled: boolean;
    users_disabled: boolean;
    admins_disabled: boolean;
  } | null>(null);
  const [lastKnownProfileStatus, setLastKnownProfileStatus] = useState<{
    status: UserStatus;
    kicked_at: string | null;
  } | null>(null);

  const isUserTemporarilyDisabled = userStatus === 'banned' || userStatus === 'kicked';

  const triggerGlobalRefresh = useCallback(() => {
    if (onGlobalRefresh) {
      console.log("[SessionContext] Triggering global refresh via callback.");
      onGlobalRefresh();
    }
  }, [onGlobalRefresh]);

  const fetchUserProfileAndRole = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user?.id) {
      setUserRole(null);
      setUserPermissions({});
      setUserAvatarUrl(null);
      setUserLanguage('es');
      setUserStatus(null);
      setLastKnownProfileStatus(null);
      return;
    }

    try {
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
        determinedPermissions = {}; 
        determinedAvatarUrl = null;
        determinedLanguage = 'es';
        determinedStatus = 'active'; 
        determinedKickedAt = null;
      } else if (profile) {
        determinedRole = profile.role as UserRole;
        determinedPermissions = profile.permissions || {};
        determinedAvatarUrl = profile.avatar_url;
        determinedLanguage = profile.language || 'es';
        determinedStatus = profile.status as UserStatus;
        determinedKickedAt = profile.kicked_at;
      } else {
        determinedRole = SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user';
        determinedPermissions = {
          can_create_server: false,
          can_manage_docker_containers: false,
          can_manage_cloudflare_domains: false,
          can_manage_cloudflare_tunnels: false,
        };
        determinedAvatarUrl = null;
        determinedLanguage = 'es';
        determinedStatus = 'active';
        determinedKickedAt = null;
      }
      
      if (determinedStatus === 'kicked' && determinedKickedAt) {
        const kickedTime = new Date(determinedKickedAt);
        const unkickTime = addMinutes(kickedTime, 15); 
        const now = new Date();

        if (now >= unkickTime) {
          console.log(`[SessionContext] User ${currentSession.user.id} was kicked, but 15 minutes have passed. Auto-unkicking locally.`);
          determinedStatus = 'active';
          determinedKickedAt = null;
          toast.info("Tu expulsión ha expirado. Puedes volver a usar la aplicación.");
        }
      }

      // Only update state if values have actually changed
      if (userRole !== determinedRole) setUserRole(determinedRole);
      if (JSON.stringify(userPermissions) !== JSON.stringify(determinedPermissions)) setUserPermissions(determinedPermissions);
      if (userAvatarUrl !== determinedAvatarUrl) setUserAvatarUrl(determinedAvatarUrl);
      if (userLanguage !== determinedLanguage) setUserLanguage(determinedLanguage);
      if (userStatus !== determinedStatus) setUserStatus(determinedStatus);
      
      // NEW: Update lastKnownProfileStatus here
      setLastKnownProfileStatus({
        status: determinedStatus,
        kicked_at: determinedKickedAt,
      });

    } catch (fetchError: any) {
      console.error('[SessionContext] Critical error during profile fetch:', fetchError);
      setUserRole(SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user');
      setUserPermissions({}); 
      setUserAvatarUrl(null);
      setUserLanguage('es');
      setUserStatus('active');
    }
  }, [supabase]); // Removed state variables from dependencies

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

      // NEW: Fetch initial global settings here
      try {
        const response = await fetch('/api/settings/public-status');
        if (response.ok) {
          const statusData = await response.json();
          setLastKnownGlobalSettings({
            maintenance_mode_enabled: statusData.maintenanceModeEnabled,
            users_disabled: statusData.usersDisabled,
            admins_disabled: statusData.adminsDisabled,
          });
        } else {
          console.warn('Could not fetch initial public status.');
        }
      } catch (error) {
        console.error('Error fetching initial public status:', error);
      }

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
  }, [router, pathname, fetchUserProfileAndRole, supabase]); // Added supabase to dependencies

  useEffect(() => {
    const checkSessionAndGlobalStatus = async () => {
      if (!session || !session.user.id) return;
      if (document.visibilityState !== 'visible') {
        console.log("[SessionContext] Tab not visible, skipping real-time status check.");
        return;
      }

      console.log(`[SessionContext] Running real-time status check for user ${session.user.id}. Current role: ${userRole}, status: ${userStatus}`);

      try {
        // Refresh Supabase session token
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn("[SessionContext] Error refreshing Supabase session:", refreshError);
          await supabase.auth.signOut();
          router.push('/login');
          return;
        }
        // If session user ID changed (e.g., user switched accounts), re-fetch profile
        if (refreshedSession && refreshedSession.user.id !== session.user.id) {
            setSession(refreshedSession);
            await fetchUserProfileAndRole(refreshedSession);
            console.log("[SessionContext] Supabase session refreshed and profile re-fetched.");
        }

        const response = await fetch('/api/settings/public-status');
        if (!response.ok) {
          console.warn('Could not fetch public status for real-time check.');
          return;
        }
        const statusData = await response.json();
        const { maintenanceModeEnabled, usersDisabled, adminsDisabled } = statusData;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, kicked_at')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          // If profile not found, but user is not super_admin, check global disables
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
          return;
        }

        const dbStatus = profile.status as UserStatus;
        const dbKickedAt = profile.kicked_at;

        // NEW: Check for changes before triggering global refresh
        let shouldTriggerGlobalRefresh = false;

        // Check for global settings changes
        if (lastKnownGlobalSettings && (
          lastKnownGlobalSettings.maintenance_mode_enabled !== maintenanceModeEnabled ||
          lastKnownGlobalSettings.users_disabled !== usersDisabled ||
          lastKnownGlobalSettings.admins_disabled !== adminsDisabled
        )) {
          console.log("[SessionContext] Global settings changed.");
          shouldTriggerGlobalRefresh = true;
        }
        // Check for profile status changes
        if (lastKnownProfileStatus && (
          lastKnownProfileStatus.status !== dbStatus ||
          lastKnownProfileStatus.kicked_at !== dbKickedAt
        )) {
          console.log("[SessionContext] User profile status changed.");
          shouldTriggerGlobalRefresh = true;
        }

        // Update last known states
        setLastKnownGlobalSettings({
          maintenance_mode_enabled: maintenanceModeEnabled,
          users_disabled: usersDisabled,
          admins_disabled: adminsDisabled,
        });
        setLastKnownProfileStatus({
          status: dbStatus,
          kicked_at: dbKickedAt,
        });

        // ... (existing global role disable, banned/kicked logic)
        // This logic should still run to enforce immediate redirects/sign-outs.
        // The `shouldTriggerGlobalRefresh` is for UI updates *after* these critical actions.

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
          if (kickedTime > fifteenMinutesAgo) {
            console.log(`[SessionContext] Real-time check: User ${session.user.id} is now kicked. Signing out.`);
            await supabase.auth.signOut();
            toast.warning("Has sido expulsado del sistema. Se ha cerrado tu sesión.");
            router.push(`/login?error=account_kicked&kicked_at=${dbKickedAt}`);
            return;
          } else {
            console.log(`[SessionContext] Real-time check: User ${session.user.id} was kicked, but 15 minutes have passed. Auto-unkicking in DB.`);
            await supabase.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', session.user.id);
            setUserStatus('active');
            toast.info("Tu expulsión ha expirado. Tu cuenta ha sido reactivada.");
            shouldTriggerGlobalRefresh = true; // Trigger refresh after auto-unkick
          }
        }
        
        if (dbStatus === 'active' && (userStatus === 'banned' || userStatus === 'kicked')) {
            console.log(`[SessionContext] Real-time check: User ${session.user.id} is now active in DB. Updating local state.`);
            setUserStatus('active');
            toast.info("Tu cuenta ha sido reactivada.");
            shouldTriggerGlobalRefresh = true; // Trigger refresh after reactivation
        }

        if (shouldTriggerGlobalRefresh) {
          console.log("[SessionContext] Triggering global refresh due to detected changes.");
          triggerGlobalRefresh();
        }

      } catch (error) {
        console.error("[SessionContext] Unhandled error in checkSessionAndGlobalStatus interval:", error);
      }
    };

    const intervalId = setInterval(checkSessionAndGlobalStatus, 30000); // Increased interval to 30 seconds
    
    // NEW: Add visibilitychange listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("[SessionContext] Tab became visible. Triggering immediate status check.");
        checkSessionAndGlobalStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, userRole, userStatus, router, fetchUserProfileAndRole, pathname, triggerGlobalRefresh, lastKnownGlobalSettings, lastKnownProfileStatus, supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }
  
  return (
    <SessionContext.Provider value={{ session, isLoading, userRole, userPermissions, userAvatarUrl, userLanguage, userStatus, isUserTemporarilyDisabled, triggerGlobalRefresh }}>
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