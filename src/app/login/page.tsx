"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun, ShieldAlert, Loader2, Ban, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LoginPage() {
  const [currentLang, setCurrentLang] = useState('es');
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [usersDisabled, setUsersDisabled] = useState(false);
  const [adminsDisabled, setAdminsDisabled] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const searchParams = useSearchParams();
  
  // State to hold kick info, independent of URL params
  const [kickInfo, setKickInfo] = useState<{ reason: string | null; kickedAt: string | null } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Errors from URL params (for non-kick related issues)
  const accountDisabledError = searchParams.get('error') === 'account_type_disabled';
  const accountBannedError = searchParams.get('error') === 'account_banned';
  const banReason = searchParams.get('reason'); // Reason for ban

  useEffect(() => {
    setIsMounted(true);
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/settings/public-status');
        const data = await response.json();
        setMaintenanceMode(data.maintenanceModeEnabled);
        setUsersDisabled(data.usersDisabled);
        setAdminsDisabled(data.adminsDisabled);
      } catch (error) {
        console.error("Failed to fetch public status, defaulting to off:", error);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    checkStatus();
  }, []);

  // Effect to load kickInfo from sessionStorage on component mount
  useEffect(() => {
    const storedInfo = sessionStorage.getItem('kickInfo');
    if (storedInfo) {
      try {
        const parsedInfo = JSON.parse(storedInfo);
        if (parsedInfo.reason && parsedInfo.kickedAt) {
          setKickInfo(parsedInfo);
        }
      } catch (e) {
        console.error("Failed to parse kickInfo from sessionStorage on mount", e);
        sessionStorage.removeItem('kickInfo');
      }
    }
  }, []); // Empty dependency array for mount only

  // Effect to update kickInfo if new URL params are present
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const reasonParam = searchParams.get('reason');
    const kickedAtParam = searchParams.get('kicked_at');

    if (errorParam === 'account_kicked' && reasonParam && kickedAtParam) {
      const info = { reason: reasonParam, kickedAt: kickedAtParam };
      sessionStorage.setItem('kickInfo', JSON.stringify(info));
      setKickInfo(info);
    }
    // IMPORTANT: Do NOT set kickInfo to null here if URL params are missing.
    // The timer effect is responsible for clearing kickInfo when it expires.
    // If URL params are missing, we should rely on the kickInfo already in state (from sessionStorage or previous URL).
  }, [searchParams]); // Dependency on searchParams

  // Effect for countdown timer, now based on state
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (kickInfo && kickInfo.kickedAt) {
      const kickTime = new Date(kickInfo.kickedAt);
      const unkickTime = addMinutes(kickTime, 15);

      const updateRemainingTime = () => {
        const now = new Date();
        if (now < unkickTime) {
          setTimeRemaining(formatDistanceToNow(unkickTime, { addSuffix: true, locale: es }));
        } else {
          // Kick expired
          setTimeRemaining(null);
          setKickInfo(null); // <-- This clears kickInfo state
          sessionStorage.removeItem('kickInfo'); // <-- This clears sessionStorage
          if (interval) clearInterval(interval);
          // Redirect to clear any lingering error params from the URL
          // Only redirect if there's an error param related to kick, otherwise it might cause infinite redirects
          if (searchParams.get('error') === 'account_kicked') {
            window.location.href = '/login'; // Force a full reload to clear URL params
          }
        }
      };

      updateRemainingTime();
      interval = setInterval(updateRemainingTime, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [kickInfo, searchParams]); // Dependency on kickInfo and searchParams

  const spanishVariables = {
    sign_in: { email_label: 'Correo electrónico', password_label: 'Contraseña', email_input_placeholder: 'Tu correo electrónico', password_input_placeholder: 'Tu contraseña', button_label: 'Iniciar sesión', social_auth_typography: 'O continuar con', link_text: '¿Ya tienes una cuenta? Inicia sesión', forgotten_password_text: '¿Olvidaste tu contraseña?', no_account_text: '¿No tienes una cuenta? Regístrate', },
    sign_up: { email_label: 'Correo electrónico', password_label: 'Contraseña', email_input_placeholder: 'Tu correo electrónico', password_input_placeholder: 'Crea una contraseña', button_label: 'Registrarse', social_auth_typography: 'O continuar con', link_text: '¿Ya tienes una cuenta? Inicia sesión', },
    forgotten_password: { email_label: 'Correo electrónico', email_input_placeholder: 'Tu correo electrónico', button_label: 'Enviar instrucciones de recuperación', link_text: '¿Recordaste tu contraseña? Inicia sesión', },
    update_password: { password_label: 'Nueva contraseña', password_input_placeholder: 'Tu nueva contraseña', button_label: 'Actualizar contraseña', },
    magic_link: { email_input_placeholder: 'Tu correo electrónico', button_label: 'Enviar enlace mágico', link_text: 'Enviar un enlace mágico por correo electrónico', },
  };
  const englishVariables = {
    sign_in: { email_label: 'Email', password_label: 'Password', email_input_placeholder: 'Your email address', password_input_placeholder: 'Your password', button_label: 'Sign In', social_auth_typography: 'Or continue with', link_text: 'Already have an account? Sign In', forgotten_password_text: 'Forgot your password?', no_account_text: 'Don\'t have an account? Sign Up', },
    sign_up: { email_label: 'Email', password_label: 'Password', email_input_placeholder: 'Your email address', password_input_placeholder: 'Create a password', button_label: 'Sign Up', social_auth_typography: 'Or continue with', link_text: 'Already have an account? Sign In', },
    forgotten_password: { email_label: 'Email', email_input_placeholder: 'Your email address', button_label: 'Send recovery instructions', link_text: 'Remembered your password? Sign In', },
    update_password: { password_label: 'New Password', password_input_placeholder: 'Your new password', button_label: 'Update Password', },
    magic_link: { email_input_placeholder: 'Your email address', button_label: 'Send magic link', link_text: 'Send a magic link by email', },
  };

  const localizationConfig = {
    lang: currentLang,
    variables: currentLang === 'es' ? spanishVariables : englishVariables,
  };

  if (isLoadingStatus) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 relative">
      {isMounted && (
        <Button variant="outline" size="icon" className="absolute top-4 right-4 h-12 w-12 rounded-full text-foreground" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
        </Button>
      )}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {maintenanceMode ? (
            <>
              <ShieldAlert className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <CardTitle className="text-2xl">Modo Mantenimiento</CardTitle>
              <CardDescription>Solo el personal autorizado puede iniciar sesión.</CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-2xl">{currentLang === 'es' ? 'Bienvenido' : 'Welcome'}</CardTitle>
              <CardDescription>{currentLang === 'es' ? 'Inicia sesión o regístrate para continuar' : 'Sign in or sign up to continue'}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {accountDisabledError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center text-sm text-destructive-foreground flex items-center gap-2">
              <Ban className="h-5 w-5" />
              <span>El inicio de sesión para tu tipo de cuenta está temporalmente desactivado.</span>
            </div>
          )}
          {accountBannedError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center text-sm text-destructive-foreground flex items-center gap-2">
              <Ban className="h-5 w-5" />
              <span>Tu cuenta ha sido baneada. {banReason && `Razón: ${banReason}`} Contacta al soporte para más información.</span>
            </div>
          )}
          {kickInfo && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-center text-sm text-yellow-200 flex flex-col items-center gap-2">
              <LogOut className="h-5 w-5" />
              <span>Has sido expulsado del sistema.</span>
              {kickInfo.reason && <span className="font-semibold">Razón: {kickInfo.reason}</span>}
              {timeRemaining && <span className="text-xs mt-1">Podrás volver a iniciar sesión {timeRemaining}.</span>}
            </div>
          )}
          {usersDisabled && !maintenanceMode && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-center text-sm text-yellow-200 flex items-center gap-2">
              <Ban className="h-5 w-5" />
              <span>El inicio de sesión para cuentas de <strong>Usuario</strong> está desactivado temporalmente.</span>
            </div>
          )}
          {adminsDisabled && !maintenanceMode && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-center text-sm text-yellow-200 flex items-center gap-2">
              <Ban className="h-5 w-5" />
              <span>El inicio de sesión para cuentas de <strong>Admin</strong> está desactivado temporalmente.</span>
            </div>
          )}
          <div className="mb-4 flex justify-end">
            <Select value={currentLang} onValueChange={setCurrentLang}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Idioma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand: 'hsl(var(--primary))', brandAccent: 'hsl(var(--primary-foreground))' } } } }}
            theme="dark"
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/` : undefined}
            localization={localizationConfig}
          />
        </CardContent>
      </Card>
    </div>
  );
}