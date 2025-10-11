"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings2, Tag, Hash, Save, Loader2, ChevronDown, ChevronRight, FileText, Users, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from 'next-themes';
import { TeamMembersManager } from '../admin/team-members-manager';
import { AuthConfigManager } from '../admin/auth-config-manager';

// Version Schema
const versionSchema = z.object({
  version: z.string().min(1, 'La versión es requerida.'),
  buildNumber: z.string().min(1, 'El número de compilación es requerido.'),
});
type VersionFormValues = z.infer<typeof versionSchema>;

// Legal Doc Schema
const legalDocSchema = z.object({
  slug: z.string(),
  title: z.string().min(1, 'El título es requerido.'),
  content: z.string().optional(),
});
type LegalDocFormValues = z.infer<typeof legalDocSchema>;
interface LegalDocument {
  slug: string;
  title: string;
  content: string | null;
  updated_at: string;
}

function VersionManager() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const form = useForm<VersionFormValues>({
    resolver: zodResolver(versionSchema),
    defaultValues: { version: '', buildNumber: '' },
  });

  const fetchVersion = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/version');
      if (!response.ok) throw new Error('No se pudo cargar la versión actual.');
      const data = await response.json();
      form.reset({ version: data.app_version, buildNumber: data.app_build_number });
    } catch (err: any) { toast.error(err.message); } finally { setIsLoading(false); }
  }, [form]);

  useEffect(() => { fetchVersion(); }, [fetchVersion]);

  const onSubmit = async (values: VersionFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/version', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchVersion();
    } catch (err: any) { toast.error(`Error al guardar: ${err.message}`); } finally { setIsSaving(false); }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {isLoading ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <div className="space-y-4 max-w-md">
            <FormField control={form.control} name="version" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Tag className="h-4 w-4" /> Versión</FormLabel><FormControl><Input placeholder="v1.0.0" {...field} disabled={isSaving} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="buildNumber" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Hash className="h-4 w-4" /> Número de Compilación</FormLabel><FormControl><Input placeholder="1234" {...field} disabled={isSaving} /></FormControl><FormMessage /></FormItem>)} />
          </div>
        )}
        <Button type="submit" disabled={isSaving || isLoading}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar Versión</Button>
      </form>
    </Form>
  );
}

function LegalDocumentsEditor() {
  const { resolvedTheme } = useTheme();
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/legal-documents');
      if (!response.ok) throw new Error('No se pudo cargar los documentos legales.');
      const data = await response.json();
      setDocs(data);
      if (data.length > 0) {
        setSelectedDoc(data[0]);
      }
    } catch (err: any) { toast.error(err.message); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleSave = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/legal-documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selectedDoc.slug, title: selectedDoc.title, content: selectedDoc.content }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchDocs();
    } catch (err: any) { toast.error(`Error al guardar: ${err.message}`); } finally { setIsSaving(false); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {docs.map(doc => (
          <Button key={doc.slug} variant={selectedDoc?.slug === doc.slug ? 'default' : 'outline'} onClick={() => setSelectedDoc(doc)}>
            {doc.title}
          </Button>
        ))}
      </div>
      {selectedDoc && (
        <div className="space-y-4">
          <Input value={selectedDoc.title} onChange={(e) => setSelectedDoc({ ...selectedDoc, title: e.target.value })} disabled={isSaving} />
          <div data-color-mode={resolvedTheme}>
            <MDEditor
              value={selectedDoc.content || ''}
              onChange={(val) => setSelectedDoc({ ...selectedDoc, content: val || '' })}
              height={400}
              preview="live"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar Documento</Button>
        </div>
      )}
    </div>
  );
}

export function OthersTab() {
  const [openItemId, setOpenItemId] = useState<string | null>('team');

  const handleToggle = (id: string) => {
    setOpenItemId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-8 p-1">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-6 w-6" /> Otras Configuraciones</CardTitle>
          <CardDescription>Configuraciones adicionales y herramientas para la gestión de la aplicación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Collapsible open={openItemId === 'team'} onOpenChange={() => handleToggle('team')} className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center justify-between w-full p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0"><Users className="h-5 w-5" /></div>
                  <div>
                    <h4 className="font-semibold">Gestión de Equipo</h4>
                    <p className="text-xs text-muted-foreground">Añade, edita o elimina miembros del equipo de la página "Sobre Nosotros".</p>
                  </div>
                </div>
                {openItemId === 'team' ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="border-t px-4 pt-4 pb-4">
                <TeamMembersManager />
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={openItemId === 'auth'} onOpenChange={() => handleToggle('auth')} className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center justify-between w-full p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0"><KeyRound className="h-5 w-5" /></div>
                  <div>
                    <h4 className="font-semibold">Configuración de Autenticación</h4>
                    <p className="text-xs text-muted-foreground">Gestiona las claves de API para Google OAuth y reCAPTCHA.</p>
                  </div>
                </div>
                {openItemId === 'auth' ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="border-t px-4 pt-4 pb-4">
                <AuthConfigManager />
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={openItemId === 'version'} onOpenChange={() => handleToggle('version')} className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center justify-between w-full p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0"><Tag className="h-5 w-5" /></div>
                  <div>
                    <h4 className="font-semibold">Gestión de Versión</h4>
                    <p className="text-xs text-muted-foreground">Actualiza la versión y el número de compilación que se muestran en la aplicación.</p>
                  </div>
                </div>
                {openItemId === 'version' ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="border-t px-4 pt-4 pb-4">
                <VersionManager />
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={openItemId === 'legal'} onOpenChange={() => handleToggle('legal')} className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center justify-between w-full p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0"><FileText className="h-5 w-5" /></div>
                  <div>
                    <h4 className="font-semibold">Gestión de Documentos Legales</h4>
                    <p className="text-xs text-muted-foreground">Edita el contenido de la Política de Privacidad y los Términos de Servicio.</p>
                  </div>
                </div>
                {openItemId === 'legal' ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="border-t px-4 pt-4 pb-4">
                <LegalDocumentsEditor />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}