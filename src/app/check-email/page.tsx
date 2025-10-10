"use client";

import React, { useEffect, useRef } from 'react';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { Button } from '@/components/ui/button';

export default function CheckEmailPage() {
  const cardRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(cardRef.current, 
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
    );
  }, []);

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12">
      <div ref={cardRef} className="w-full max-w-md text-center bg-card p-8 rounded-lg border">
        <MailCheck className="h-16 w-16 text-green-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold">¡Casi listo! Revisa tu correo</h1>
        <p className="text-muted-foreground mt-4 mb-8">
          Hemos enviado un enlace de verificación a tu dirección de correo electrónico. Por favor, haz clic en el enlace para activar tu cuenta.
        </p>
        <p className="text-sm text-muted-foreground">
          ¿No recibiste el correo? Revisa tu carpeta de spam o intenta registrarte de nuevo.
        </p>
        <Button asChild className="mt-8 w-full bg-primary-light-purple hover:bg-primary-light-purple/90 text-white">
          <Link href="/login">Volver a Iniciar Sesión</Link>
        </Button>
      </div>
    </div>
  );
}