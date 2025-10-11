"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, KeyRound } from 'lucide-react';
import { GoogleLogo } from '@/components/google-logo';

const googleSchema = z.object({
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
});

const recaptchaSchema = z.object({
  client_id: z.string().optional(), // Site Key
  client_secret: z.string().optional(), // Secret Key
});

type GoogleFormValues = z.infer<typeof googleSchema>;
type RecaptchaFormValues = z.infer<typeof recaptchaSchema>;

export function AuthConfigManager() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGoogle, setIsSavingGoogle] = useState(false);
  const [isSavingRecaptcha, setIsSavingRecaptcha] = useState(false);

  const googleForm = useForm<GoogleFormValues>({ resolver: zodResolver(googleSchema), defaultValues: { client_id: '', client_secret: '' } });
  const recaptchaForm = useForm<RecaptchaFormValues>({ resolver: zodResolver(recaptchaSchema), defaultValues: { client_id: '', client_secret: '' } });

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/auth-configs');
      if (!response.ok) throw new Error('Failed to fetch auth configs');
      const data = await response.json();
      googleForm.reset({ client_id: data.google?.client_id || '' });
      recaptchaForm.reset({ client_id: data.recaptcha?.client_id || '' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [googleForm, recaptchaForm]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const onSave = async (provider: 'google' | 'recaptcha', values: GoogleFormValues | RecaptchaFormValues) => {
    const setIsSaving = provider === 'google' ? setIsSavingGoogle : setIsSavingRecaptcha;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/auth-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...values }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchConfigs();
    } catch (error: any) {
      toast.error(`Error saving ${provider} config: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium flex items-center gap-2 mb-4"><GoogleLogo /> Configuración de Google OAuth</h4>
        <Form {...googleForm}>
          <form onSubmit={googleForm.handleSubmit((values) => onSave('google', values))} className="space-y-4">
            <FormField control={googleForm.control} name="client_id" render={({ field }) => (<FormItem><FormLabel>Client ID</FormLabel><FormControl><Input {...field} disabled={isSavingGoogle} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={googleForm.control} name="client_secret" render={({ field }) => (<FormItem><FormLabel>Client Secret</FormLabel><FormControl><Input type="password" placeholder="Dejar en blanco para no cambiar" {...field} disabled={isSavingGoogle} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={isSavingGoogle}>{isSavingGoogle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar Google</Button>
          </form>
        </Form>
      </div>
      <div>
        <h4 className="font-medium flex items-center gap-2 mb-4"><KeyRound className="h-5 w-5" /> Configuración de Google reCAPTCHA</h4>
        <Form {...recaptchaForm}>
          <form onSubmit={recaptchaForm.handleSubmit((values) => onSave('recaptcha', values))} className="space-y-4">
            <FormField control={recaptchaForm.control} name="client_id" render={({ field }) => (<FormItem><FormLabel>Site Key (v3)</FormLabel><FormControl><Input {...field} disabled={isSavingRecaptcha} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={recaptchaForm.control} name="client_secret" render={({ field }) => (<FormItem><FormLabel>Secret Key (v3)</FormLabel><FormControl><Input type="password" placeholder="Dejar en blanco para no cambiar" {...field} disabled={isSavingRecaptcha} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={isSavingRecaptcha}>{isSavingRecaptcha ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar reCAPTCHA</Button>
          </form>
        </Form>
      </div>
    </div>
  );
}