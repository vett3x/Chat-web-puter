"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun, ShieldAlert, Loader2, Ban } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [currentLang, setCurrentLang] = useState('es');
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [usersDisabled, setUsersDisabled] = useState(false);
  const [adminsDisabled, setAdminsDisabled] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const searchParams = useSearchParams();
  const accountDisabledError = searchParams.get('error') === 'account_type_disabled';

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

  // ... (spanishVariables and englishVariables remain the same)
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

  if (maintenanceMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <ShieldAlert className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Servicio en Mantenimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              El inicio de sesión está temporalmente desactivado. Por favor, inténtalo de nuevo más tarde.
            </p>
          </CardContent>
        </Card>
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
          <CardTitle className="text-2xl">{currentLang === 'es' ? 'Bienvenido' : 'Welcome'}</CardTitle>
          <CardDescription>{currentLang === 'es' ? 'Inicia sesión o regístrate para continuar' : 'Sign in or sign up to continue'}</CardDescription>
        </CardHeader>
        <CardContent>
          {accountDisabledError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center text-sm text-destructive-foreground flex items-center gap-2">
              <Ban className="h-5 w-5" />
              <span>El inicio de sesión para tu tipo de cuenta está temporalmente desactivado.</span>
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