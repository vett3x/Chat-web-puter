"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod'; // CORREGIDO: Sintaxis de importación de zod

import { useApiKeysManagement } from '@/hooks/use-api-keys-management';
import { ApiKeyForm } from '@/components/api-management/api-key-form'; // CORREGIDO: Eliminada extensión .tsx
import { ApiKeyTable } from '@/components/api-management/api-key-table'; // CORREGIDO: Eliminada extensión .tsx

const apiKeySchema = z.object({
  id: z.string().optional(),
  provider: z.string().min(1, { message: 'Debes seleccionar un proveedor.' }),
  api_key: z.string().trim().optional().or(z.literal('')),
  nickname: z.string().trim().optional().or(z.literal('')),
  project_id: z.string().trim().optional().or(z.literal('')),
  location_id: z.string().trim().optional().or(z.literal('')),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().trim().optional().or(z.literal('')),
  json_key_file: z.any().optional(),
  json_key_content: z.string().optional(),
  api_endpoint: z.string().trim().url({ message: 'URL de endpoint inválida.' }).optional().or(z.literal('')),
  is_global: z.boolean().optional(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiManagementDialog({ open, onOpenChange }: ApiManagementDialogProps) {
  const {
    keys,
    isLoading,
    isSubmitting,
    editingKeyId,
    selectedJsonKeyFile,
    jsonKeyFileName,
    searchQuery,
    isSuperAdmin,
    currentUserId,
    fetchKeys,
    handleEditKey,
    handleCancelEdit,
    handleJsonKeyFileChange,
    handleRemoveJsonKeyFile,
    handleSubmit,
    handleDelete,
    setSearchQuery,
  } = useApiKeysManagement();

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      provider: '',
      api_key: '',
      nickname: '',
      project_id: '',
      location_id: '',
      use_vertex_ai: false,
      model_name: '',
      json_key_file: undefined,
      json_key_content: undefined,
      api_endpoint: '',
      is_global: false,
    },
  });

  // Effect to reset form when editingKeyId changes
  useEffect(() => {
    if (editingKeyId) {
      const keyToEdit = keys.find(k => k.id === editingKeyId);
      if (keyToEdit) {
        form.reset({
          id: keyToEdit.id,
          provider: keyToEdit.provider,
          nickname: keyToEdit.nickname || '',
          api_key: '', // API key is masked, so don't pre-fill
          project_id: keyToEdit.project_id || '',
          location_id: keyToEdit.location_id || '',
          use_vertex_ai: keyToEdit.use_vertex_ai || false,
          model_name: keyToEdit.model_name || '',
          json_key_file: undefined,
          json_key_content: undefined,
          api_endpoint: keyToEdit.api_endpoint || '',
          is_global: keyToEdit.is_global,
        });
      }
    } else {
      form.reset({
        provider: '', api_key: '', nickname: '', project_id: '', location_id: '',
        use_vertex_ai: false, model_name: '', json_key_file: undefined, json_key_content: undefined,
        api_endpoint: '', is_global: false,
      });
    }
  }, [editingKeyId, keys, form]);

  // Effect to fetch keys when dialog opens
  useEffect(() => {
    if (open) {
      fetchKeys();
      handleCancelEdit(); // Ensure form is reset and not in editing mode
      setSearchQuery('');
    }
  }, [open, fetchKeys, handleCancelEdit, setSearchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-6 max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-6 w-6" /> Gestión de API Keys de IA
          </DialogTitle>
          <DialogDescription>
            Añade y gestiona tus API keys para diferentes proveedores de IA. Estas claves se usarán para las conversaciones.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6 flex-1 flex flex-col">
          <Card>
            <DialogHeader>
              <DialogTitle className="text-lg">{editingKeyId ? 'Actualizar API Key' : 'Añadir Nueva API Key'}</DialogTitle>
            </DialogHeader>
            <ApiKeyForm
              form={form}
              onSubmit={(values: ApiKeyFormValues) => handleSubmit(values, form.reset)}
              isSubmitting={isSubmitting}
              editingKeyId={editingKeyId}
              onCancelEdit={handleCancelEdit}
              selectedJsonKeyFile={selectedJsonKeyFile}
              onJsonKeyFileChange={handleJsonKeyFileChange}
              onRemoveJsonKeyFile={handleRemoveJsonKeyFile}
              jsonKeyFileName={jsonKeyFileName}
              isSuperAdmin={isSuperAdmin}
            />
          </Card>
          <Separator />
          <ApiKeyTable
            keys={keys}
            isLoading={isLoading}
            onEditKey={handleEditKey}
            onDeleteKey={handleDelete}
            editingKeyId={editingKeyId}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            isSuperAdmin={isSuperAdmin}
            currentUserId={currentUserId}
            onRefreshKeys={fetchKeys}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}