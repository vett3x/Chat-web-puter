"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Image as ImageIcon, Upload, Save, Trash2, Palette, Text, Bot, ChevronRight, ChevronDown, BrainCircuit, Droplets } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUserApiKeys, ApiKey, AiKeyGroup } from '@/hooks/use-user-api-keys';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const personalizationSchema = z.object({
  app_name: z.string().optional(),
  app_tagline: z.string().optional(),
  app_welcome_title: z.string().optional(),
  app_welcome_description: z.string().optional(),
  theme_primary_color: z.string().optional(),
  theme_sidebar_color: z.string().optional(),
  theme_accent_color: z.string().optional(),
  theme_border_radius: z.coerce.number().min(0).max(1).optional(),
  default_ai_model: z.string().optional(),
  chat_bubble_background_color: z.string().optional(),
  chat_bubble_border_color: z.string().optional(),
  chat_bubble_blur: z.coerce.number().min(0).max(32).optional(),
  liquid_ether_opacity: z.coerce.number().min(0).max(1).optional(),
});

type PersonalizationFormValues = z.infer<typeof personalizationSchema>;

interface PersonalizationItemProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const PersonalizationItem: React.FC<PersonalizationItemProps> = ({ id, icon, label, description, children, isOpen, onToggle }) => (
  <Collapsible open={isOpen} onOpenChange={onToggle} className="border rounded-lg">
    <CollapsibleTrigger asChild>
      <button className="flex items-center justify-between w-full p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">{icon}</div>
          <div>
            <h4 className="font-semibold">{label}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
      <div className="border-t px-4 pt-4 pb-4">
        {children}
      </div>
    </CollapsibleContent>
  </Collapsible>
);

export function PersonalizationTab() {
  const [currentSettings, setCurrentSettings] = useState<any>({});
  const [loginBgFile, setLoginBgFile] = useState<File | null>(null);
  const [appLogoFile, setAppLogoFile] = useState<File | null>(null);
  const [appFaviconFile, setAppFaviconFile] = useState<File | null>(null);
  const [loginBgPreview, setLoginBgPreview] = useState<string | null>(null);
  const [appLogoPreview, setAppLogoPreview] = useState<string | null>(null);
  const [appFaviconPreview, setAppFaviconPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const { userApiKeys, aiKeyGroups, isLoadingApiKeys } = useUserApiKeys();

  const loginBgInputRef = useRef<HTMLInputElement>(null);
  const appLogoInputRef = useRef<HTMLInputElement>(null);
  const appFaviconInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PersonalizationFormValues>({
    resolver: zodResolver(personalizationSchema),
    defaultValues: {
      app_name: '',
      app_tagline: '',
      app_welcome_title: '',
      app_welcome_description: '',
      theme_primary_color: '#000000',
      theme_sidebar_color: '#000000',
      theme_accent_color: '#000000',
      theme_border_radius: 0.5,
      default_ai_model: '',
      chat_bubble_background_color: 'hsla(0, 0%, 100%, 0.1)',
      chat_bubble_border_color: 'hsla(0, 0%, 100%, 0.2)',
      chat_bubble_blur: 4,
      liquid_ether_opacity: 0.5,
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
        app_tagline: data.app_tagline || '',
        app_welcome_title: data.app_welcome_title || '',
        app_welcome_description: data.app_welcome_description || '',
        theme_primary_color: data.theme_primary_color || '#000000',
        theme_sidebar_color: data.theme_sidebar_color || '#000000',
        theme_accent_color: data.theme_accent_color || '#000000',
        theme_border_radius: data.theme_border_radius || 0.5,
        default_ai_model: data.default_ai_model || '',
        chat_bubble_background_color: data.chat_bubble_background_color || 'hsla(0, 0%, 100%, 0.1)',
        chat_bubble_border_color: data.chat_bubble_border_color || 'hsla(0, 0%, 100%, 0.2)',
        chat_bubble_blur: data.chat_bubble_blur || 4,
        liquid_ether_opacity: data.liquid_ether_opacity || 0.5,
      });
      setLoginBgPreview(data.login_background_url);
      setAppLogoPreview(data.app_logo_url);
      setAppFaviconPreview(data.app_favicon_url);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'login_background' | 'app_logo' | 'app_favicon') => {
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
      } else if (type === 'app_logo') {
        setAppLogoFile(file);
        setAppLogoPreview(URL.createObjectURL(file));
      } else {
        setAppFaviconFile(file);
        setAppFaviconPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleSave = async (values: PersonalizationFormValues) => {
    setIsSaving(true);
    const formData = new FormData();
    formData.append('settings', JSON.stringify(values));
    if (loginBgFile) formData.append('login_background', loginBgFile);
    if (appLogoFile) formData.append('app_logo', appLogoFile);
    if (appFaviconFile) formData.append('app_favicon', appFaviconFile);

    try {
      const response = await fetch('/api/admin/personalization', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Configuración guardada. Refresca la página para ver todos los cambios.');
      setLoginBgFile(null);
      setAppLogoFile(null);
      setAppFaviconFile(null);
      fetchSettings();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAsset = async (type: 'login_background' | 'app_logo' | 'app_favicon') => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/personalization?type=${type}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Recurso eliminado.');
      if (type === 'login_background') {
        setLoginBgFile(null);
        setLoginBgPreview(null);
      } else if (type === 'app_logo') {
        setAppLogoFile(null);
        setAppLogoPreview(null);
      } else {
        setAppFaviconFile(null);
        setAppFaviconPreview(null);
      }
      fetchSettings();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (id: string) => {
    setOpenItemId(prev => (prev === id ? null : id));
  };

  const availableModels = React.useMemo(() => {
    const models: { value: string; label: string; isGlobal?: boolean }[] = [];
    AI_PROVIDERS.filter(p => p.source === 'puter').forEach(provider => {
      provider.models.forEach(model => {
        models.push({ value: `puter:${model.value}`, label: `${provider.company}: ${model.label}` });
      });
    });
    aiKeyGroups.forEach(group => {
      const activeKeysCount = group.api_keys?.filter(k => k.status === 'active').length || 0;
      if (activeKeysCount > 0) {
        let label = group.name;
        models.push({ value: `group:${group.id}`, label, isGlobal: group.is_global });
      }
    });
    userApiKeys.filter(key => !key.group_id && key.status === 'active').forEach(key => {
      let label = key.nickname || `Clave ${key.id.substring(0, 4)}`;
      models.push({ value: `user_key:${key.id}`, label, isGlobal: key.is_global });
    });
    return models;
  }, [userApiKeys, aiKeyGroups]);

  return (
    <div className="p-1">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)}>
          <Card>
            <CardHeader>
              <CardTitle>Personalización de la Aplicación</CardTitle>
              <CardDescription>Define la identidad visual, colores y apariencia de tu aplicación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <PersonalizationItem id="app_name" icon={<Text className="h-5 w-5" />} label="Nombre de la Aplicación" description="El nombre que se mostrará en toda la aplicación." isOpen={openItemId === 'app_name'} onToggle={() => handleToggle('app_name')}>
                <FormField control={form.control} name="app_name" render={({ field }) => (<FormItem><FormControl><Input placeholder="DeepAI Coder" {...field} /></FormControl></FormItem>)} />
              </PersonalizationItem>
              <PersonalizationItem id="app_tagline" icon={<Text className="h-5 w-5" />} label="Lema de la Aplicación" description="Un subtítulo o eslogan para tu aplicación." isOpen={openItemId === 'app_tagline'} onToggle={() => handleToggle('app_tagline')}>
                <FormField control={form.control} name="app_tagline" render={({ field }) => (<FormItem><FormControl><Input placeholder="Tu asistente de IA para crear software." {...field} /></FormControl></FormItem>)} />
              </PersonalizationItem>
              <PersonalizationItem id="app_logo" icon={<Bot className="h-5 w-5" />} label="Logo de la Aplicación" description="Sube el logo de tu aplicación (PNG, max 5MB)." isOpen={openItemId === 'app_logo'} onToggle={() => handleToggle('app_logo')}>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                    {appLogoPreview ? <Image src={appLogoPreview} alt="Vista previa del logo" layout="fill" objectFit="contain" /> : <div className="flex items-center justify-center h-full text-muted-foreground"><Bot className="h-8 w-8" /></div>}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => appLogoInputRef.current?.click()} disabled={isSaving}><Upload className="mr-2 h-4 w-4" /> Cambiar</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => handleRemoveAsset('app_logo')} disabled={!currentSettings.app_logo_url || isSaving}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
                  </div>
                </div>
              </PersonalizationItem>
              <PersonalizationItem id="app_favicon" icon={<ImageIcon className="h-5 w-5" />} label="Favicon de la Aplicación" description="El ícono para la pestaña del navegador (PNG, max 5MB)." isOpen={openItemId === 'app_favicon'} onToggle={() => handleToggle('app_favicon')}>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                    {appFaviconPreview ? <Image src={appFaviconPreview} alt="Vista previa del favicon" layout="fill" objectFit="contain" /> : <div className="flex items-center justify-center h-full text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => appFaviconInputRef.current?.click()} disabled={isSaving}><Upload className="mr-2 h-4 w-4" /> Cambiar</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => handleRemoveAsset('app_favicon')} disabled={!currentSettings.app_favicon_url || isSaving}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
                  </div>
                </div>
              </PersonalizationItem>
              <PersonalizationItem id="login_background" icon={<ImageIcon className="h-5 w-5" />} label="Fondo de Inicio de Sesión" description="Imagen de fondo para la página de login." isOpen={openItemId === 'login_background'} onToggle={() => handleToggle('login_background')}>
                <input type="file" ref={loginBgInputRef} onChange={(e) => handleFileChange(e, 'login_background')} accept="image/*" hidden />
                <div className="relative w-full h-24 bg-muted rounded-md overflow-hidden mb-2">
                  {loginBgPreview ? <Image src={loginBgPreview} alt="Vista previa del fondo" layout="fill" objectFit="cover" /> : <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><ImageIcon className="h-8 w-8" /><p className="text-xs mt-1">Sin fondo</p></div>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => loginBgInputRef.current?.click()} disabled={isSaving}><Upload className="mr-2 h-4 w-4" /> Cambiar</Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => handleRemoveAsset('login_background')} disabled={!currentSettings.login_background_url || isSaving}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
                </div>
              </PersonalizationItem>
              <PersonalizationItem id="theme_colors" icon={<Palette className="h-5 w-5" />} label="Colores del Tema" description="Personaliza la paleta de colores de la interfaz." isOpen={openItemId === 'theme_colors'} onToggle={() => handleToggle('theme_colors')}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField control={form.control} name="theme_primary_color" render={({ field }) => (<FormItem><FormLabel className="text-xs">Primario</FormLabel><FormControl><Input type="color" {...field} className="h-10 p-1" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="theme_sidebar_color" render={({ field }) => (<FormItem><FormLabel className="text-xs">Barra Lateral</FormLabel><FormControl><Input type="color" {...field} className="h-10 p-1" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="theme_accent_color" render={({ field }) => (<FormItem><FormLabel className="text-xs">Acento</FormLabel><FormControl><Input type="color" {...field} className="h-10 p-1" /></FormControl></FormItem>)} />
                </div>
              </PersonalizationItem>
              <PersonalizationItem id="chat_style" icon={<Droplets className="h-5 w-5" />} label="Estilo del Chat" description="Ajusta el efecto de cristal y el fondo animado." isOpen={openItemId === 'chat_style'} onToggle={() => handleToggle('chat_style')}>
                <div className="space-y-4">
                  <FormField control={form.control} name="chat_bubble_background_color" render={({ field }) => (<FormItem><FormLabel>Color de Fondo de Burbuja (con opacidad)</FormLabel><FormControl><Input placeholder="hsla(0, 0%, 100%, 0.1)" {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="chat_bubble_border_color" render={({ field }) => (<FormItem><FormLabel>Color de Borde de Burbuja (con opacidad)</FormLabel><FormControl><Input placeholder="hsla(0, 0%, 100%, 0.2)" {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="chat_bubble_blur" render={({ field }) => (<FormItem><FormLabel>Intensidad de Desenfoque (Blur)</FormLabel><FormControl><Slider defaultValue={[field.value || 4]} min={0} max={32} step={1} onValueChange={(value) => field.onChange(value[0])} /></FormControl><span className="text-xs text-muted-foreground">{field.value}px</span></FormItem>)} />
                  <FormField control={form.control} name="liquid_ether_opacity" render={({ field }) => (<FormItem><FormLabel>Opacidad del Fondo Animado</FormLabel><FormControl><Slider defaultValue={[field.value || 0.5]} min={0} max={1} step={0.1} onValueChange={(value) => field.onChange(value[0])} /></FormControl><span className="text-xs text-muted-foreground">{Math.round((field.value || 0) * 100)}%</span></FormItem>)} />
                </div>
              </PersonalizationItem>
              <PersonalizationItem id="default_ai_model" icon={<BrainCircuit className="h-5 w-5" />} label="Modelo de IA por Defecto" description="El modelo de IA predeterminado para nuevos usuarios y chats." isOpen={openItemId === 'default_ai_model'} onToggle={() => handleToggle('default_ai_model')}>
                <FormField control={form.control} name="default_ai_model" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value} disabled={isSaving || isLoadingApiKeys}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un modelo..." /></SelectTrigger></FormControl><SelectContent>{availableModels.map((model) => (<SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>))}</SelectContent></Select></FormItem>)} />
              </PersonalizationItem>
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
      <input type="file" ref={appLogoInputRef} onChange={(e) => handleFileChange(e, 'app_logo')} accept="image/*" hidden />
      <input type="file" ref={appFaviconInputRef} onChange={(e) => handleFileChange(e, 'app_favicon')} accept="image/*" hidden />
    </div>
  );
}