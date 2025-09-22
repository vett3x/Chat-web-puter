"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SUPERUSER_EMAILS } from '@/lib/constants'; // Importación actualizada

type UserRole = 'user' | 'admin' | 'super_admin';

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  userRole: UserRole | null; // Changed from isSuperUser to userRole
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null); // State for userRole
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserProfileAndRole = async (currentSession: Session | null) => {
    if (currentSession?.user?.id) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentSession.user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile role:', error);
        setUserRole(null); // Default to null on error
      } else if (profile) {
        setUserRole(profile.role as UserRole);
      } else {
        // Fallback if profile not found (shouldn't happen with trigger)
        setUserRole(SUPERUSER_EMAILS.includes(currentSession.user.email || '') ? 'super_admin' : 'user');
      }
    } else {
      setUserRole(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      setIsLoading(false);
      await fetchUserProfileAndRole(currentSession); // Fetch role on auth state change

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
      await fetchUserProfileAndRole(initialSession); // Fetch role on initial session load

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
    <SessionContext.Provider value={{ session, isLoading, userRole }}>
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