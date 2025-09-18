"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  isSuperUser: boolean; // Added isSuperUser flag
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Define SuperUser emails (for client-side check, should be managed by backend later)
const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperUser, setIsSuperUser] = useState(false); // State for SuperUser
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      setIsLoading(false);
      setIsSuperUser(currentSession?.user?.email ? SUPERUSER_EMAILS.includes(currentSession.user.email) : false);

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

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setIsLoading(false);
      setIsSuperUser(initialSession?.user?.email ? SUPERUSER_EMAILS.includes(initialSession.user.email) : false);
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
    <SessionContext.Provider value={{ session, isLoading, isSuperUser }}>
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