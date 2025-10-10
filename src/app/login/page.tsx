"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Loader2, Ban, LogOut, LogIn, Wand2, Star, ArrowLeft, ArrowRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';
import Link from 'next/link';
import { gsap } from 'gsap';
import { useTheme } from 'next-themes';

export default function LoginPage() {
  const { theme } = useTheme();
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

  const leftColumnRef = useRef(null);
  const rightColumnRef = useRef(null);

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
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('error');
          newUrl.searchParams.delete('reason');
          newUrl.searchParams.delete('kicked_at');
          window.history.replaceState({}, '', newUrl);
        }
      };

      updateRemainingTime();
      interval = setInterval(updateRemainingTime, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [accountKickedError, kickedAt]);

  useEffect(() => {
    if (isMounted) {
      gsap.fromTo(leftColumnRef.current, 
        { opacity: 0, x: -50 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' }
      );
      gsap.fromTo(rightColumnRef.current, 
        { opacity: 0, x: 50 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 }
      );
    }
  }, [isMounted]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground grid grid-cols-1 lg:grid-cols-2">
      {/* Left Column: Form */}
      <div ref={leftColumnRef} className="flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <Wand2 className="h-7 w-7 text-primary-light-purple" />
              <span className="text-xl font-bold">DeepAI Coder</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Bienvenido de nuevo</h1>
          <p className="text-muted-foreground mt-2 mb-6">Por favor, introduce tus datos para continuar.</p>

          {isLoadingStatus ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : (
            <>
              {maintenanceMode && (
                <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 rounded-md text-center text-sm text-yellow-800 flex items-center gap-2 dark:bg-yellow-900/20 dark:border-yellow-800/30 dark:text-yellow-200">
                  <ShieldAlert className="h-5 w-5" />
                  <span>Modo Mantenimiento: Solo personal autorizado puede iniciar sesión.</span>
                </div>
              )}
              {accountDisabledError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-md text-center text-sm text-red-800 flex items-center gap-2 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-200">
                  <Ban className="h-5 w-5" />
                  <span>El inicio de sesión para tu tipo de cuenta está temporalmente desactivado.</span>
                </div>
              )}
              {accountBannedError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-md text-center text-sm text-red-800 flex items-center gap-2 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-200">
                  <Ban className="h-5 w-5" />
                  <span>Tu cuenta ha sido baneada. {kickReason && `Razón: ${kickReason}`}</span>
                </div>
              )}
              {accountKickedError && (
                <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 rounded-md text-center text-sm text-yellow-800 flex flex-col items-center gap-2 dark:bg-yellow-900/20 dark:border-yellow-800/30 dark:text-yellow-200">
                  <LogOut className="h-5 w-5" />
                  <span>Has sido expulsado del sistema.</span>
                  {kickReason && <span className="font-semibold">Razón: {kickReason}</span>}
                  {timeRemaining && <span className="text-xs mt-1">Podrás volver a iniciar sesión {timeRemaining}.</span>}
                </div>
              )}
              {usersDisabled && !maintenanceMode && (
                <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 rounded-md text-center text-sm text-yellow-800 flex items-center gap-2 dark:bg-yellow-900/20 dark:border-yellow-800/30 dark:text-yellow-200">
                  <Ban className="h-5 w-5" />
                  <span>El inicio de sesión para cuentas de <strong>Usuario</strong> está desactivado.</span>
                </div>
              )}
              {adminsDisabled && !maintenanceMode && (
                <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 rounded-md text-center text-sm text-yellow-800 flex items-center gap-2 dark:bg-yellow-900/20 dark:border-yellow-800/30 dark:text-yellow-200">
                  <Ban className="h-5 w-5" />
                  <span>El inicio de sesión para cuentas de <strong>Admin</strong> está desactivado.</span>
                </div>
              )}

              <Auth
                supabaseClient={supabase}
                providers={[]}
                appearance={{ theme: ThemeSupa }}
                theme={theme === 'dark' ? 'dark' : 'light'}
                localization={{
                  variables: {
                    sign_in: { email_label: 'Correo electrónico', password_label: 'Contraseña', button_label: 'Iniciar Sesión', link_text: '¿No tienes una cuenta? Regístrate' },
                    sign_up: { email_label: 'Correo electrónico', password_label: 'Contraseña', button_label: 'Registrarse', link_text: '¿Ya tienes una cuenta? Inicia sesión', confirmation_text: 'Revisa tu correo para el enlace de confirmación.' },
                    forgotten_password: { email_label: 'Correo electrónico', button_label: 'Enviar instrucciones', link_text: '¿Olvidaste tu contraseña?', confirmation_text: 'Revisa tu correo para el enlace de recuperación.' },
                    update_password: { password_label: 'Nueva contraseña', button_label: 'Actualizar contraseña', confirmation_text: 'Tu contraseña ha sido actualizada.' },
                  },
                }}
                redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/app` : undefined}
              />
            </>
          )}
        </div>
      </div>

      {/* Right Column: Image & Testimonial */}
      <div ref={rightColumnRef} className="hidden lg:block relative">
        <Image
          src={backgroundUrl || "/login-background.png"}
          alt="Mujer trabajando en un proyecto"
          layout="fill"
          objectFit="cover"
          className="opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-12 text-white">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 border border-white/20">
            <blockquote className="text-xl font-medium leading-relaxed">
              "Hemos estado usando DeepAI Coder para iniciar cada nuevo proyecto y no podemos imaginar trabajar sin él. Es increíble."
            </blockquote>
            <div className="mt-6 flex justify-between items-center">
              <div>
                <p className="font-semibold">Fleur Cook</p>
                <p className="text-sm text-white/70">Fundadora, Catalog</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />)}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="rounded-full bg-white/10 border-white/20 hover:bg-white/20">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full bg-white/10 border-white/20 hover:bg-white/20">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}