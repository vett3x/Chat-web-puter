"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Image as ImageIcon, Upload, Save, Trash2, Palette, Text, Bot } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';

const personalizationSchema = z.object({
  app_name: z.string().optional(),
  theme_primary_color: z.string().optional(),
  theme_sidebar_color: z.string().optional(),
});

type PersonalizationFormValues = z.infer<typeof personalizationSchema>;

export function PersonalizationTab() {
  const [currentSettings, setCurrentSettings] = useState<any>({});
  const [loginBgFile, setLoginBgFile] = useState<File | null>(null);
  const [appLogoFile, setAppLogoFile] = useState<File | null>(null);
  const [loginBgPreview, setLoginBgPreview] = useState<string | null>(null);
  const [appLogoPreview, setAppLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loginBgInputRef = useRef<HTMLInputElement>(null);
  const appLogoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PersonalizationFormValues>({
    resolver: zodResolver(personalizationSchema),
    defaultValues: {
      app_name: '',
      theme_primary_color: '#000000',
      theme_sidebar_color: '#000000',
    },
  });

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/personalization');
      if (!response.ok) throw new Error('No se pudo cargar la configuración.');
      const data = await response.json();
      setCurrentSettings(data);
      form.reset({
        app_name: data.app_name || '',
        theme_primary_color: data.theme_primary_color || '#000000',
        theme_sidebar_color: data.theme_sidebar_color || '#000000',
      });
      setLoginBgPreview(data.login_background_url);
      setAppLogoPreview(data.app_logo_url);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'login_background' | 'app_logo') => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecciona un archivo de imagen.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no debe exceder los 5MB.');
        return;
      }
      if (type === 'login_background') {
        setLoginBgFile(file);
        setLoginBgPreview(URL.createObjectURL(file));
      } else {
        setAppLogoFile(file);
        setAppLogoPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleSave = async (values: PersonalizationFormValues) => {
    setIsSaving(true);
    const formData = new FormData();
    formData.append('settings', JSON.stringify(values));
    if (loginBgFile) formData.append('login_background', loginBgFile);
    if (appLogoFile) formData.append('app_logo', appLogoFile);

    try {
      const response = await fetch('/api/admin/personalization', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Configuración guardada. Refresca la página para ver todos los cambios.');
      setLoginBgFile(null);
      setAppLogoFile(null);
      fetchSettings();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAsset = async (type: 'login_background' | 'app_logo') => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/personalization?type=${type}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Recurso eliminado.');
      if (type === 'login_background') {
        setLoginBgFile(null);
        setLoginBgPreview(null);
      } else {
        setAppLogoFile(null);
        setAppLogoPreview(null);
      }
      fetchSettings();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-1">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)}>
          <Card>
            <CardHeader>
              <CardTitle>Personalización de la Aplicación</CardTitle>
              <CardDescription>Define la identidad visual, colores y apariencia de tu aplicación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section 1: Marca */}
              <div>
                <h3 className="text-lg font-medium mb-4">Marca</h3>
                <div className="space-y-4">
                  <FormField control={form.control} name="app_name" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2 text-sm"><Text className="h-4 w-4" /> Nombre de la Aplicación</FormLabel><FormControl><Input placeholder="DeepAI Coder" {...field} /></FormControl></FormItem>)} />
                  <div>
                    <FormLabel className="flex items-center gap-2 mb-2 text-sm"><Bot className="h-4 w-4" /> Logo de la Aplicación</FormLabel>
                    <div className="border rounded-lg p-3 flex flex-col sm:flex-row items-center gap-3">
                      <div className="relative w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                        {appLogoPreview ? <Image src={appLogoPreview} alt="Vista previa del logo" layout="fill" objectFit="contain" /> : <div className="flex items-center justify-center h-full text-muted-foreground"><Bot className="h-8 w-8" /></div>}
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs text-muted-foreground">Sube el logo de tu aplicación (recomendado: 256x256px, PNG transparente, max 5MB).</p>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => appLogoInputRef.current?.click()} disabled={isSaving}><Upload className="mr-2 h-4 w-4" /> Cambiar</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => handleRemoveAsset('app_logo')} disabled={!currentSettings.app_logo_url || isSaving}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Section 2: Colores */}
              <div>
                <h3 className="text-lg font-medium mb-4">Colores del Tema</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="theme_primary_color" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2 text-sm"><Palette className="h-4 w-4" /> Color Primario</FormLabel><FormControl><Input type="color" {...field} className="h-10 p-1" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="theme_sidebar_color" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2 text-sm"><Palette className="h-4 w-4" /> Color de la Barra Lateral</FormLabel><FormControl><Input type="color" {...field} className="h-10 p-1" /></FormControl></FormItem>)} />
                </div>
              </div>

              <Separator />

              {/* Section 3: Login */}
              <div>
                <h3 className="text-lg font-medium mb-4">Página de Inicio de Sesión</h3>
                <input type="file" ref={loginBgInputRef} onChange={(e) => handleFileChange(e, 'login_background')} accept="image/*" hidden />
                <div className="border rounded-lg p-3 space-y-3">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                    <div className="relative w-full h-32 bg-muted rounded-md overflow-hidden">
                      {loginBgPreview ? <Image src={loginBgPreview} alt="Vista previa del fondo" layout="fill" objectFit="cover" /> : <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><ImageIcon className="h-8 w-8 mb-2" /><p className="text-xs">Sin fondo personalizado</p></div>}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => loginBgInputRef.current?.click()} disabled={isSaving}><Upload className="mr-2 h-4 w-4" /> Cambiar Fondo</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => handleRemoveAsset('login_background')} disabled={!currentSettings.login_background_url || isSaving}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}