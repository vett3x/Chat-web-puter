"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Mail, KeyRound, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

const emailFormSchema = z.object({
  email: z.string().email({ message: 'Correo electrónico inválido.' }),
});

const passwordFormSchema = z.object({
  password: z.string().min(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres.' }),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface UserAccountTabProps {
  userId: string;
  userEmail: string;
  currentUserRole: 'user' | 'admin' | 'super_admin' | null;
  targetUserRole: 'user' | 'admin' | 'super_admin';
  onAccountUpdated: () => void;
}

export function UserAccountTab({ userId, userEmail, currentUserRole, targetUserRole, onAccountUpdated }: UserAccountTabProps) {
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const canEdit = currentUserRole === 'super_admin' && targetUserRole !== 'super_admin';

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: userEmail },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: '' },
  });

  const handleUpdate = async (type: 'email' | 'password', values: EmailFormValues | PasswordFormValues) => {
    if (type === 'email') setIsUpdatingEmail(true);
    if (type === 'password') setIsUpdatingPassword(true);

    try {
      const response = await fetch(`/api/users/${userId}/account`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...values }),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      onAccountUpdated();
      if (type === 'password') passwordForm.reset();
    } catch (err: any) {
      toast.error(`Error al actualizar: ${err.message}`);
    } finally {
      if (type === 'email') setIsUpdatingEmail(false);
      if (type === 'password') setIsUpdatingPassword(false);
    }
  };

  if (!canEdit) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" /> Gestión de Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Solo los Super Admins pueden modificar los datos de la cuenta de otros usuarios (excepto otros Super Admins).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Cambiar Correo Electrónico</CardTitle>
          <CardDescription>
            Esto enviará un correo de confirmación al nuevo y al antiguo correo electrónico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit((values) => handleUpdate('email', values))} className="space-y-4">
              <FormField control={emailForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuevo Correo Electrónico</FormLabel>
                  <FormControl><Input {...field} disabled={isUpdatingEmail} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={isUpdatingEmail}>
                {isUpdatingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Actualizar Correo
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Cambiar Contraseña</CardTitle>
          <CardDescription>
            La contraseña se cambiará inmediatamente. El usuario deberá iniciar sesión con la nueva contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit((values) => handleUpdate('password', values))} className="space-y-4">
              <FormField control={passwordForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva Contraseña</FormLabel>
                  <FormControl><Input type="password" {...field} disabled={isUpdatingPassword} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={isUpdatingPassword}>
                {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Actualizar Contraseña
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}