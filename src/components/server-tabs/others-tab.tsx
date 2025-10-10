"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Settings2, Tag, Hash, Save, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const versionSchema = z.object({
  version: z.string().min(1, 'La versión es requerida.'),
  buildNumber: z.string().min(1, 'El número de compilación es requerido.'),
});

type VersionFormValues = z.infer<typeof versionSchema>;

export function OthersTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [openItemId, setOpenItemId] = useState<string | null>('version'); // Default open

  const form = useForm<VersionFormValues>({
    resolver: zodResolver(versionSchema),
    defaultValues: {
      version: '',
      buildNumber: '',
    },
  });

  const fetchVersion = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/public-version');
      if (!response.ok) throw new Error('No se pudo cargar la versión actual.');
      const data = await response.json();
      form.reset({
        version: data.app_version,
        buildNumber: data.app_build_number,
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  const onSubmit = async (values: VersionFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/version', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchVersion(); // Refresh data after saving
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (id: string) => {
    setOpenItemId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-8 p-1">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-6 w-6" />
                Otras Configuraciones
              </CardTitle>
              <CardDescription>
                Configuraciones adicionales y herramientas para la gestión de la aplicación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
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
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4 max-w-md">
                        <FormField
                          control={form.control}
                          name="version"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2"><Tag className="h-4 w-4" /> Versión</FormLabel>
                              <FormControl>
                                <Input placeholder="v1.0.0" {...field} disabled={isSaving} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="buildNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2"><Hash className="h-4 w-4" /> Número de Compilación</FormLabel>
                              <FormControl>
                                <Input placeholder="1234" {...field} disabled={isSaving} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              {/* Future collapsible items will go here */}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={isSaving || isLoading}>
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