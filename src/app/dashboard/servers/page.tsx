"use client";

import React from 'react';
import { useSession } from '@/components/session-context-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ServerManagementForm } from '@/components/server-management-form';
import { Loader2 } from 'lucide-react';

export default function ServersPage() {
  const { session, isLoading, isSuperUser } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!session || !isSuperUser)) {
      router.push('/'); // Redirect non-SuperUsers or unauthenticated users
    }
  }, [session, isLoading, isSuperUser, router]);

  if (isLoading || !session || !isSuperUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <h1 className="text-3xl font-bold mb-6">Gestión de Servidores</h1>
      <p className="text-muted-foreground mb-8">
        Aquí puedes añadir y gestionar los servidores que utilizará DeepCoder para desplegar entornos de desarrollo.
        Recuerda que las credenciales SSH se enviarán a tu backend de orquestación para su gestión segura.
      </p>
      <ServerManagementForm />
    </div>
  );
}