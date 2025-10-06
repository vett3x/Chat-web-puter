"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ServerListTab } from './server-list-tab';
import { AllDockerContainersTab } from './all-docker-containers-tab';
import { UsageHistoryTab } from './usage-history-tab';
import { CloudflareTunnelTab } from './cloudflare-tunnel-tab';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wand2, Save, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { DatabaseConfigTab } from '@/components/admin/database-config-tab';
import { S3StorageTab } from './s3-storage-tab';
import { S3BackupsTab } from './s3-backups-tab';

const templateSchema = z.object({
  template: z.string().min(1, 'La plantilla no puede estar vacía.'),
});
type TemplateFormValues = z.infer<typeof templateSchema>;

function ProvisioningTemplateCard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { template: '' },
  });

  const fetchTemplate = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/provisioning');
      if (!response.ok) throw new Error((await response.json()).message);
      const data = await response.json();
      form.reset({ template: data.template });
    } catch (err: any) {
      toast.error(`Error al cargar la plantilla: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const onSubmit = async (values: TemplateFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/provisioning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary-light-purple" />
          Configuración de Aprovisionamiento de DeepAI Coder
        </CardTitle>
        <CardDescription>
          Modifica la plantilla del comando `docker run` que se utiliza para crear nuevos contenedores. Las cuotas se basan en el perfil del usuario que crea la aplicación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plantilla del Comando `docker run`</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="font-mono text-xs h-48"
                        disabled={isSaving}
                        spellCheck="false"
                      />
                    </FormControl>
                    <FormDescription>
                      Placeholders disponibles: [nombre-generado], [puerto-aleatorio], [quota_flags], [variables_de_entorno_bd], [volumen-generado], [imagen_base], [entrypoint_command]
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Plantilla
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

export function InfrastructureTab() {
  return (
    <div className="space-y-8 p-1">
      <ProvisioningTemplateCard />
      <Separator />
      <ServerListTab />
      <Separator />
      <AllDockerContainersTab />
      <Separator />
      <CloudflareTunnelTab />
      <Separator />
      <UsageHistoryTab />
      <Separator />
      <DatabaseConfigTab />
      <Separator />
      <S3StorageTab />
      <Separator />
      <S3BackupsTab />
    </div>
  );
}