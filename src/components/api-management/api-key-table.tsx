"use client";

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Edit, Trash2, Search } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getModelLabel } from '@/lib/ai-models';
import { ApiKey } from '@/hooks/use-api-keys-management'; // Import ApiKey interface

interface ApiKeyTableProps {
  keys: ApiKey[];
  isLoading: boolean;
  onEditKey: (key: ApiKey) => void;
  onDeleteKey: (keyId: string) => void;
  editingKeyId: string | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  isSuperAdmin: boolean;
  currentUserId: string | undefined;
  onRefreshKeys: () => void;
}

export function ApiKeyTable({
  keys,
  isLoading,
  onEditKey,
  onDeleteKey,
  editingKeyId,
  searchQuery,
  onSearchQueryChange,
  isSuperAdmin,
  currentUserId,
  onRefreshKeys,
}: ApiKeyTableProps) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Claves Guardadas</h3>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clave..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="icon" onClick={onRefreshKeys} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Apodo</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Clave / Configuración</TableHead>
              {isSuperAdmin && <TableHead>Global</TableHead>}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : keys.length === 0 ? (
              <TableRow><TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center text-muted-foreground">No hay claves que coincidan con la búsqueda.</TableCell></TableRow>
            ) : (
              keys.map(key => {
                const canManageKey = isSuperAdmin || (!key.is_global && key.user_id === currentUserId);

                return (
                  <TableRow key={key.id}>
                    <TableCell>{key.nickname || 'N/A'}</TableCell>
                    <TableCell>{getModelLabel(key.provider)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {key.provider === 'custom_endpoint' ? (
                        <div className="flex flex-col">
                          <span>Endpoint: {key.api_endpoint || 'N/A'}</span>
                          <span className="text-muted-foreground">Modelo ID: {key.model_name || 'N/A'}</span>
                          <span className="text-muted-foreground">API Key: {key.api_key ? `${key.api_key.substring(0, 4)}...${key.api_key.substring(key.api_key.length - 4)}` : 'N/A'}</span>
                        </div>
                      ) : key.use_vertex_ai ? (
                        <div className="flex flex-col">
                          <span>Vertex AI (Activo)</span>
                          <span className="text-muted-foreground">Project: {key.project_id || 'N/A'}</span>
                          <span className="text-muted-foreground">Location: {key.location_id || 'N/A'}</span>
                          <span className="text-muted-foreground">Modelo: {getModelLabel(key.model_name ?? undefined) || 'N/A'}</span>
                          {key.json_key_content && <span className="text-muted-foreground">JSON Key: Subido</span>}
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span>{key.api_key}</span>
                          <span className="text-muted-foreground">Modelo: {getModelLabel(key.model_name ?? undefined) || 'N/A'}</span>
                        </div>
                      )}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        {key.is_global ? 'Sí' : 'No'}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => onEditKey(key)} 
                          disabled={editingKeyId !== null || !canManageKey}
                          title={!canManageKey ? "No tienes permiso para editar esta clave" : "Editar clave"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          onClick={() => onDeleteKey(key.id)} 
                          disabled={editingKeyId !== null || !canManageKey}
                          title={!canManageKey ? "No tienes permiso para eliminar esta clave" : "Eliminar clave"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}