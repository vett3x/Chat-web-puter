"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun, ShieldAlert, Loader2, Ban, LogOut, LogIn } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [usersDisabled, setUsersDisabled] = useState(false);
  const [adminsDisabled, setAdminsDisabled] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const accountDisabledError = searchParams.get('error') === 'account_type_disabled';
  const accountBannedError = searchParams.get('error') === 'account_banned';
  const accountKickedError = searchParams.get('error') === 'account_kicked';
  const kickReason = searchParams.get('reason');
  const kickedAt = searchParams.get('kicked_at');
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    
    const checkStatus = async () => {
      try {
        const [statusRes, brandingRes] = await Promise.all([
          fetch('/api/settings/public-status'),
          fetch('/api/settings/public-branding')
        ]);
        const statusData = await statusRes.json();
        const brandingData = await brandingRes.json();
        setMaintenanceMode(statusData.maintenanceModeEnabled);
        setUsersDisabled(statusData.usersDisabled);
        setAdminsDisabled(statusData.adminsDisabled);
        setBackgroundUrl(brandingData.login_background_url);
      } catch (error) {
        console.error("Failed to fetch public settings, defaulting to off:", error);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    // Automatically open the dialog if there's a login-related error in the URL
    if (accountDisabledError || accountBannedError || accountKickedError) {
      onOpenChange(true);
    }
  }, [accountDisabledError, accountBannedError, accountKickedError, onOpenChange]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (accountKickedError && kickedAt) {
      const kickTime = new Date(kickedAt);
      const unkickTime = addMinutes(kickTime, 15);

      const updateRemainingTime = () => {
        const now = new Date();
        if (now < unkickTime) {
          setTimeRemaining(formatDistanceToNow(unkickTime, { addSuffix: true, locale: es }));
        } else {
          setTimeRemaining(null);
          if (interval) clearInterval(interval);
          // Clear error params from URL without reloading the page
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('error');
          newUrl.searchParams.delete('reason');
          newUrl.searchParams.delete('kicked_at');
          window.history.replaceState({}, '', newUrl);
          onOpenChange(false); // Close the dialog
        }
      };

      updateRemainingTime();
      interval = setInterval(updateRemainingTime, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [accountKickedError, kickedAt, onOpenChange]);

  const backgroundStyle = backgroundUrl ? {
    backgroundImage: `url(${backgroundUrl})`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  } : {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-0 bg-transparent max-w-[450px] w-[95vw] overflow-hidden">
        <div className="w-full h-full" style={backgroundUrl ? {} : { backgroundImage: 'url(/background-pattern.svg)' }}>
          <div className="w-full h-full p-0" style={backgroundStyle}>
            <div className="relative w-full backdrop-blur-xl border-2 border-[hsl(var(--primary-color-login))] rounded-[15px] pt-[7.5em] pb-[4em] px-[1.5em] sm:px-[2.5em] text-[hsl(var(--second-color-login))] shadow-lg shadow-black/20">
              
              <div className="login-header absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center bg-[hsl(var(--primary-color-login))] w-[100px] h-[70px] rounded-b-[20px] z-10">
                <LogIn className="h-10 w-10 text-black" />
              </div>

              {isLoadingStatus ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : (
                <>
                  {maintenanceMode && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-center text-sm text-yellow-200 flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5" />
                      <span>Modo Mantenimiento: Solo personal autorizado puede iniciar sesión.</span>
                    </div>
                  )}
                  {accountDisabledError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center text-sm text-white flex items-center gap-2">
                      <Ban className="h-5 w-5" />
                      <span>El inicio de sesión para tu tipo de cuenta está temporalmente desactivado.</span>
                    </div>
                  )}
                  {accountBannedError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center text-sm text-white flex items-center gap-2">
                      <Ban className="h-5 w-5" />
                      <span>Tu cuenta ha sido baneada. {kickReason && `Razón: ${kickReason}`}</span>
                    </div>
                  )}
                  {accountKickedError && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-center text-sm text-yellow-200 flex flex-col items-center gap-2">
                      <LogOut className="h-5 w-5" />
                      <span>Has sido expulsado del sistema.</span>
                      {kickReason && <span className="font-semibold">Razón: {kickReason}</span>}
                      {timeRemaining && <span className="text-xs mt-1">Podrás volver a iniciar sesión {timeRemaining}.</span>}
                    </div>
                  )}
                  {usersDisabled && !maintenanceMode && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-center text-sm text-yellow-200 flex items-center gap-2">
                      <Ban className="h-5 w-5" />
                      <span>El inicio de sesión para cuentas de <strong>Usuario</strong> está desactivado.</span>
                    </div>
                  )}
                  {adminsDisabled && !maintenanceMode && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-center text-sm text-yellow-200 flex items-center gap-2">
                      <Ban className="h-5 w-5" />
                      <span>El inicio de sesión para cuentas de <strong>Admin</strong> está desactivado.</span>
                    </div>
                  )}

                  <Auth
                    supabaseClient={supabase}
                    providers={[]}
                    appearance={{
                      theme: ThemeSupa,
                      variables: {
                        default: {
                          colors: {
                            brand: 'hsl(var(--primary-color-login))',
                            brandAccent: 'hsl(var(--black-color-login))',
                            brandButtonText: 'hsl(var(--black-color-login))',
                            defaultButtonBackground: 'transparent',
                            defaultButtonBackgroundHover: 'hsl(var(--primary-color-login) / 0.1)',
                            defaultButtonBorder: 'hsl(var(--primary-color-login))',
                            defaultButtonText: 'hsl(var(--second-color-login))',
                            inputBackground: 'transparent',
                            inputBorder: 'hsl(var(--primary-color-login))',
                            inputBorderHover: 'hsl(var(--primary-color-login))',
                            inputBorderFocus: 'hsl(var(--second-color-login))',
                            inputText: 'hsl(var(--second-color-login))',
                            inputLabelText: 'hsl(var(--second-color-login))',
                            inputPlaceholder: 'hsl(var(--primary-color-login))',
                            messageText: 'hsl(var(--second-color-login))',
                            messageTextDanger: 'hsl(var(--destructive))',
                            anchorTextColor: 'hsl(var(--second-color-login))',
                            anchorTextHoverColor: 'hsl(var(--primary-color-login))',
                          },
                          space: {
                            inputPadding: '1rem 1.5rem',
                            buttonPadding: '0.75rem 1.5rem',
                          },
                          radii: {
                            borderRadiusButton: '30px',
                            buttonBorderRadius: '30px',
                            inputBorderRadius: '30px',
                          },
                        },
                      },
                    }}
                    localization={{
                      variables: {
                        sign_in: {
                          email_label: 'Correo electrónico',
                          password_label: 'Contraseña',
                          email_input_placeholder: 'Tu correo electrónico',
                          password_input_placeholder: 'Tu contraseña',
                          button_label: 'Iniciar Sesión',
                          link_text: '¿No tienes una cuenta? Regístrate',
                          loading_button_label: 'Iniciando sesión...',
                          social_provider_text: 'Iniciar sesión con {{provider}}',
                        },
                        sign_up: {
                          email_label: 'Correo electrónico',
                          password_label: 'Contraseña',
                          email_input_placeholder: 'Tu correo electrónico',
                          password_input_placeholder: 'Tu nueva contraseña',
                          button_label: 'Registrarse',
                          link_text: '¿Ya tienes una cuenta? Inicia sesión',
                          loading_button_label: 'Registrando...',
                          social_provider_text: 'Registrarse con {{provider}}',
                          confirmation_text: 'Revisa tu correo para el enlace de confirmación.',
                        },
                        forgotten_password: {
                          email_label: 'Correo electrónico',
                          password_label: 'Tu contraseña',
                          button_label: 'Enviar instrucciones',
                          link_text: '¿Olvidaste tu contraseña?',
                          loading_button_label: 'Enviando instrucciones...',
                          confirmation_text: 'Revisa tu correo para el enlace de recuperación.',
                        },
                        update_password: {
                          password_label: 'Nueva contraseña',
                          password_input_placeholder: 'Tu nueva contraseña',
                          button_label: 'Actualizar contraseña',
                          loading_button_label: 'Actualizando contraseña...',
                          confirmation_text: 'Tu contraseña ha sido actualizada.',
                        },
                      },
                    }}
                    theme="dark"
                    redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/app` : undefined}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}