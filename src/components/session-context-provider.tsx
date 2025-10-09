"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SUPERUSER_EMAILS, PERMISSION_KEYS } from '@/lib/constants';
import { toast } from 'sonner';
import { addMinutes } from 'date-fns';

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
  triggerGlobalRefresh: () => void;
  userDefaultModel: string | null;
  globalRefreshKey: number; // New key to trigger refreshes
  hasNewUserSupportTickets: boolean; // NEW: State for user support tickets
  setHasNewUserSupportTickets: (value: boolean) => void; // NEW: Setter for user support tickets
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
  const [userDefaultModel, setUserDefaultModel] = useState<string | null>(null);
  const [globalRefreshKey, setGlobalRefreshKey] = useState(0); // New state
  const [hasNewUserSupportTickets, setHasNewUserSupportTickets] = useState(false); // NEW: State for user support tickets
  const router = useRouter();
  const pathname = usePathname();
  const isInitialProfileFetch = useRef(true);

  const isUserTemporarilyDisabled = userStatus === 'banned' || userStatus === 'kicked';

  const triggerGlobalRefresh = useCallback(() => {
    setGlobalRefreshKey(prev => prev + 1);
    if (onGlobalRefresh) {
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
      setUserDefaultModel(null);
      isInitialProfileFetch.current = false;
      return;
    }

    try {
      let determinedRole: UserRole | null = null;
      let determinedPermissions: UserPermissions = {};
      let determinedAvatarUrl: string | null = null;
      let determinedLanguage: string | null = 'es';
      let determinedStatus: UserStatus = 'active';
      let determinedKickedAt: string | null = null;
      let determinedDefaultModel: string | null = null;

      if (SUPERUSER_EMAILS.includes(currentSession.user.email || '')) {
        determinedRole = 'super_admin';
        for (const key of Object.values(PERMISSION_KEYS)) {
          determinedPermissions[key] = true;
        }
        const { data: profile } = await supabase.from('profiles').select('avatar_url, language, status, kicked_at, default_ai_model').eq('id', currentSession.user.id).single();
        if (profile) {
          determinedAvatarUrl = profile.avatar_url;
          determinedLanguage = profile.language || 'es';
          determinedStatus = profile.status as UserStatus;
          determinedKickedAt = profile.kicked_at;
          determinedDefaultModel = profile.default_ai_model;
        }
      } else {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, permissions, avatar_url, language, status, kicked_at, default_ai_model')
          .eq('id', currentSession.user.id)
          .single();

        if (error) {
          console.error('[SessionContext] Error fetching user profile:', error);
          if (!isInitialProfileFetch.current) {
            toast.error('Error al cargar el perfil del usuario.');
          }
          determinedRole = 'user';
        } else if (profile) {
          determinedRole = profile.role as UserRole;
          determinedPermissions = profile.permissions || {};
          determinedAvatarUrl = profile.avatar_url;
          determinedLanguage = profile.language || 'es';
          determinedStatus = profile.status as UserStatus;
          determinedKickedAt = profile.kicked_at;
          determinedDefaultModel = profile.default_ai_model;
        } else {
          determinedRole = 'user';
        }
      }
      
      if (determinedStatus === 'kicked' && determinedKickedAt) {
        const kickedTime = new Date(determinedKickedAt);
        const unkickTime = addMinutes(kickedTime, 15); 
        const now = new Date();
        if (now >= unkickTime) {
          determinedStatus = 'active';
        }
      }

      setUserRole(determinedRole);
      setUserPermissions(determinedPermissions);
      setUserAvatarUrl(determinedAvatarUrl);
      setUserLanguage(determinedLanguage);
      setUserStatus(determinedStatus);
      setUserDefaultModel(determinedDefaultModel);

    } catch (fetchError: any) {
      console.error('[SessionContext] Critical error during profile fetch:', fetchError);
      if (!isInitialProfileFetch.current) {
        toast.error('Error al cargar el perfil del usuario.');
      }
      setUserRole(SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user');
    } finally {
      isInitialProfileFetch.current = false;
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[SessionContext] App became visible. Forcing Supabase realtime reconnection.');
        supabase.removeAllChannels();
        triggerGlobalRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [triggerGlobalRefresh]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      await fetchUserProfileAndRole(currentSession);
      setIsLoading(false);

      if (event === 'SIGNED_OUT' || !currentSession) {
        if (pathname !== '/login') {
          router.push('/login');
        }
      } else if (currentSession && pathname === '/login') {
        router.push('/');
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      await fetchUserProfileAndRole(initialSession);
      setIsLoading(false);
      if (!initialSession && pathname !== '/login') {
        router.push('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname, fetchUserProfileAndRole]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const profileChannel = supabase
      .channel(`profiles:id=eq.${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        async (payload) => {
          console.log('[Realtime] Profile change received:', payload.new);
          const newProfile = payload.new as any;
          const newStatus = newProfile.status as UserStatus;
          const newRole = newProfile.role as UserRole;

          setUserStatus(newStatus);
          setUserRole(newRole);
          setUserPermissions(newProfile.permissions || {});
          setUserAvatarUrl(newProfile.avatar_url);
          setUserLanguage(newProfile.language || 'es');
          setUserDefaultModel(newProfile.default_ai_model);

          if (newStatus === 'banned' || newStatus === 'kicked') {
            toast.error(`Tu cuenta ha sido ${newStatus === 'banned' ? 'baneada' : 'expulsada'}. Se cerrará tu sesión.`);
            await supabase.auth.signOut();
            router.push('/login');
          } else if (newStatus === 'active' && userStatus !== 'active') {
            toast.success("Tu cuenta ha sido reactivada.");
          }
        }
      )
      .subscribe();

    const supportTicketMessagesChannel = supabase
      .channel(`support_ticket_messages_for_user_${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_ticket_messages' },
        async (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.sender_id !== session.user.id && !newMessage.is_internal_note) {
            const { data: ticket, error } = await supabase
              .from('support_tickets')
              .select('subject')
              .eq('id', newMessage.ticket_id)
              .eq('user_id', session.user.id)
              .single();

            if (error) {
              console.error('Error fetching ticket for notification:', error);
              return;
            }

            if (ticket) {
              setHasNewUserSupportTickets(true);
              toast.info(`¡Nueva respuesta en tu ticket: "${ticket.subject}"!`, {
                description: 'Haz clic en "Mis Tickets" en la configuración de tu cuenta para verla.',
                duration: 8000,
              });
              triggerGlobalRefresh();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(supportTicketMessagesChannel);
    };
  }, [session?.user?.id, router, userStatus, triggerGlobalRefresh, globalRefreshKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }
  
  return (
    <SessionContext.Provider value={{ session, isLoading, userRole, userPermissions, userAvatarUrl, userLanguage, userStatus, isUserTemporarilyDisabled, triggerGlobalRefresh, userDefaultModel, globalRefreshKey, hasNewUserSupportTickets, setHasNewUserSupportTickets }}>
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