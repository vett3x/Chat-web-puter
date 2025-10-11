"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';

const formSchema = z.object({
  name: z.string().min(2, 'El nombre es muy corto.'),
  email: z.string().email('Email inválido.'),
  message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres.'),
});

type FormValues = z.infer<typeof formSchema>;

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    const fetchSiteKey = async () => {
      try {
        const response = await fetch('/api/recaptcha/site-key');
        const data = await response.json();
        if (data.siteKey) {
          setRecaptchaSiteKey(data.siteKey);
        }
      } catch (error) {
        console.error("Failed to fetch reCAPTCHA site key:", error);
      }
    };
    fetchSiteKey();
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', message: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const recaptchaToken = await recaptchaRef.current?.executeAsync();
      if (!recaptchaToken) {
        throw new Error('No se pudo obtener el token de reCAPTCHA. Por favor, inténtalo de nuevo.');
      }

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, recaptchaToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      form.reset();
      recaptchaRef.current?.reset();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!recaptchaSiteKey) {
    return (
      <div className="text-center text-white/70">
        El formulario de contacto no está disponible en este momento.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} className="bg-white/5 border-white/20" /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} className="bg-white/5 border-white/20" /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="message" render={({ field }) => (<FormItem><FormLabel>Mensaje</FormLabel><FormControl><Textarea {...field} rows={5} className="bg-white/5 border-white/20" /></FormControl><FormMessage /></FormItem>)} />
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={recaptchaSiteKey}
          size="invisible"
          theme="dark"
        />
        <Button type="submit" disabled={isSubmitting} className="w-full bg-primary-light-purple hover:bg-primary-light-purple/90 text-white">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar Mensaje
        </Button>
      </form>
    </Form>
  );
}