"use client";

import { supabase } from '@/integrations/supabase/client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldAlert, Loader2, Ban, LogOut, Wand2, Star, ArrowLeft, ArrowRight } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatDistanceToNow, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';
import Link from 'next/link';
import { gsap } from 'gsap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { GoogleLogo } from '@/components/google-logo';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const loginSchema = z.object({
  email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
  password: z.string().min(1, { message: 'La contraseña es requerida.' }),
  remember: z.boolean().default(false).optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
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

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });

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

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error(error.message || 'Error al iniciar sesión.');
    } else {
      toast.success('Inicio de sesión exitoso.');
      router.push('/app');
    }
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    });
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground grid grid-cols-1 lg:grid-cols-3">
      {/* Left Column: Form */}
      <div ref={leftColumnRef} className="lg:col-span-2 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 bg-card">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <Wand2 className="h-7 w-7 text-primary-light-purple" />
              <span className="text-xl font-bold">DeepAI Coder</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Bienvenido de nuevo</h1>
          <p className="text-muted-foreground mt-2 mb-6">¡Bienvenido de nuevo! Por favor, introduce tus datos.</p>

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

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="email">Email</Label>
                        <FormControl>
                          <Input id="email" placeholder="Introduce tu email" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="password">Contraseña</Label>
                        <FormControl>
                          <Input id="password" type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name="remember"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox id="remember" checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} />
                          </FormControl>
                          <Label htmlFor="remember" className="text-sm font-medium leading-none">Recordarme por 30 días</Label>
                        </FormItem>
                      )}
                    />
                    <Link href="#" className="text-sm font-semibold text-primary-light-purple hover:underline">
                      Olvidé mi contraseña
                    </Link>
                  </div>
                  <div className="space-y-4">
                    <Button type="submit" className="w-full bg-primary-light-purple hover:bg-primary-light-purple/90 text-white" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Iniciar Sesión
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
                      <GoogleLogo className="mr-2" />
                      Iniciar sesión con Google
                    </Button>
                  </div>
                </form>
              </Form>
              <p className="mt-8 text-center text-sm text-muted-foreground">
                ¿No tienes una cuenta?{' '}
                <Link href="#" className="font-semibold text-primary-light-purple hover:underline">
                  Regístrate
                </Link>
              </p>
            </>
          )}
        </div>
        <p className="absolute bottom-4 left-4 text-sm text-muted-foreground">© DeepAI Coder {new Date().getFullYear()}</p>
      </div>

      {/* Right Column: Image & Testimonial */}
      <div ref={rightColumnRef} className="hidden lg:block relative lg:col-span-1">
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