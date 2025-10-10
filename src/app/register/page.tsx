"use client";

import { supabase } from '@/integrations/supabase/client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wand2, Star, ArrowLeft, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { gsap } from 'gsap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { GoogleLogo } from '@/components/google-logo';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const registerSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const leftColumnRef = useRef(null);
  const rightColumnRef = useRef(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    setIsMounted(true);
    const fetchBranding = async () => {
      try {
        const res = await fetch('/api/settings/public-branding');
        const data = await res.json();
        setBackgroundUrl(data.register_background_url);
      } catch (error) {
        console.error("Failed to fetch branding settings:", error);
      }
    };
    fetchBranding();
  }, []);

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

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
        },
      },
    });

    if (error) {
      toast.error(error.message || 'Error al registrar la cuenta.');
    } else {
      toast.success('¡Registro exitoso! Por favor, revisa tu correo para verificar tu cuenta.');
      router.push('/check-email');
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
          <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
          <p className="text-muted-foreground mt-2 mb-6">Empieza a construir con el poder de la IA.</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="first_name">Nombre</Label>
                      <FormControl>
                        <Input id="first_name" placeholder="Tu nombre" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="last_name">Apellido</Label>
                      <FormControl>
                        <Input id="last_name" placeholder="Tu apellido" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
              <div className="space-y-4">
                <Button type="submit" className="w-full bg-primary-light-purple hover:bg-primary-light-purple/90 text-white" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Crear Cuenta
                </Button>
                <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
                  <GoogleLogo className="mr-2" />
                  Registrarse con Google
                </Button>
              </div>
            </form>
          </Form>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="font-semibold text-primary-light-purple hover:underline">
              Inicia sesión
            </Link>
          </p>
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