"use client";

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CreateContainerFormValues, TUNNEL_CREATION_SUMMARY_SCRIPT } from './create-container-constants';

interface CloudflareDomain {
  id: string;
  domain_name: string;
  zone_id: string;
  account_id: string;
}

interface CreateContainerFormFieldsProps {
  form: UseFormReturn<CreateContainerFormValues>;
  isCreatingContainer: boolean;
  isLoadingCloudflareDomains: boolean;
  cloudflareDomains: CloudflareDomain[];
  canManageDockerContainers: boolean;
  canManageCloudflareTunnels: boolean;
}

export function CreateContainerFormFields({
  form,
  isCreatingContainer,
  isLoadingCloudflareDomains,
  cloudflareDomains,
  canManageDockerContainers,
  canManageCloudflareTunnels,
}: CreateContainerFormFieldsProps) {
  return (
    <div className="space-y-4 py-4">
      <FormField control={form.control} name="image" render={({ field }) => (<FormItem><FormLabel>Imagen</FormLabel><FormControl><Input placeholder="ubuntu:latest" {...field} disabled /></FormControl><FormDescription>Imagen base para Next.js (no editable).</FormDescription><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre (Opcional)</FormLabel><FormControl><Input placeholder="mi-app-nextjs" {...field} /></FormControl><FormMessage /></FormItem>)} />
      
      <FormField
        control={form.control}
        name="container_port"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Puerto Interno del Contenedor</FormLabel>
            <FormControl>
              <Input type="number" placeholder="3000" {...field} disabled={isCreatingContainer} />
            </FormControl>
            <FormDescription>
              El puerto dentro del contenedor al que tu aplicación Next.js escuchará (ej. 3000).
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="host_port"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Puerto del Host (Opcional)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="Dejar vacío para asignar uno aleatorio" {...field} disabled={isCreatingContainer} />
            </FormControl>
            <FormDescription>
              El puerto en el servidor físico que se mapeará al puerto interno del contenedor. Si se deja vacío, se asignará uno aleatorio.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <>
        <FormField
          control={form.control}
          name="cloudflare_domain_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dominio de Cloudflare (para túnel)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isCreatingContainer || isLoadingCloudflareDomains || cloudflareDomains.length === 0 || !canManageCloudflareTunnels}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un dominio registrado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingCloudflareDomains ? (
                    <SelectItem value="loading" disabled>Cargando dominios...</SelectItem>
                  ) : cloudflareDomains.length === 0 ? (
                    <SelectItem value="no-domains" disabled>No hay dominios registrados</SelectItem>
                  ) : (
                    cloudflareDomains.map((domain) => (
                      <SelectItem key={domain.id} value={domain.id}>
                        {domain.domain_name} (Zone ID: {domain.zone_id.substring(0, 8)}...)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormDescription>
                Se usará para crear un túnel Cloudflare automáticamente.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subdomain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subdominio (Opcional, para túnel)</FormLabel>
              <FormControl>
                <Input placeholder="mi-app-nextjs" {...field} disabled={isCreatingContainer || !canManageCloudflareTunnels} />
              </FormControl>
              <FormDescription>
                Si se deja vacío, se generará un subdominio aleatorio.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </>

      <FormField
        control={form.control}
        name="script_install_deps"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Script de Instalación de Dependencias del Contenedor</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                className="font-mono text-xs h-64"
                disabled={isCreatingContainer || !canManageDockerContainers}
                spellCheck="false"
              />
            </FormControl>
            <FormDescription>
              Este script se ejecuta dentro del contenedor para instalar Node.js, npm y cloudflared.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormItem>
        <FormLabel>Secuencia de Creación del Túnel Cloudflare (Resumen)</FormLabel>
        <FormControl>
          <Textarea
            value={TUNNEL_CREATION_SUMMARY_SCRIPT}
            className="font-mono text-xs h-96"
            readOnly
            spellCheck="false"
          />
        </FormControl>
        <FormDescription>
          Este es un resumen de los pasos que el backend realiza para crear y aprovisionar el túnel. No es editable.
        </FormDescription>
      </FormItem>
    </div>
  );
}