"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Server, Trash2, Info, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { ServerDetailDialog } from '../server-detail-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSession } from '@/components/session-context-provider'; // Import useSession
import { PERMISSION_KEYS } from '@/lib/constants'; // Import PERMISSION_KEYS

const serverFormSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  ssh_port: z.coerce.number().int().min(1).max(65535).default(22).optional(),
  name: z.string().optional(),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

interface RegisteredServer {
  id: string;
  name?: string;
  ip_address: string;
  ssh_port?: number;
  status: 'pending' | 'provisioning' | 'ready' | 'failed';
  provisioning_log?: string | null;
}

const DEEPCODER_API_BASE_PATH = '/api/servers'; // Variable name remains for consistency

function AddServerForm({ onServerAdded }: { onServerAdded: () => void }) {
  const { userPermissions } = useSession(); // Get user permissions
  const [isAddingServer, setIsAddingServer] = useState(false);
  const canCreateServer = userPermissions[PERMISSION_KEYS.CAN_CREATE_SERVER];

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      ip_address: '',
      ssh_username: '',
      ssh_password: '',
      ssh_port: 22,
      name: '',
    },
  });

  const onSubmit = async (values: ServerFormValues) => {
    setIsAddingServer(true);
    try {
      const response = await fetch(DEEPCODER_API_BASE_PATH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      toast.success(result.message || 'Servidor añadido correctamente.');
      form.reset({ ssh_port: 22 });
      onServerAdded();
    } catch (error: any) {
      console.error('Error adding server:', error);
      toast.error(`Error al añadir el servidor: ${error.message}`);
    } finally {
      setIsAddingServer(false);
    }
  };

  if (!canCreateServer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <PlusCircle className="h-6 w-6" /> Añadir Nuevo Servidor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No tienes permiso para añadir nuevos servidores.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-6 w-6" /> Añadir Nuevo Servidor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre del Servidor (Opcional)</FormLabel><FormControl><Input placeholder="Mi Servidor de Desarrollo" {...field} disabled={isAddingServer} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="ip_address" render={({ field }) => (<FormItem><FormLabel>Dirección IP</FormLabel><FormControl><Input placeholder="192.168.1.100" {...field} disabled={isAddingServer} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="ssh_username" render={({ field }) => (<FormItem><FormLabel>Usuario SSH</FormLabel><FormControl><Input placeholder="root" {...field} disabled={isAddingServer} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="ssh_password" render={({ field }) => (<FormItem><FormLabel>Contraseña SSH</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isAddingServer} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="ssh_port" render={({ field }) => (<FormItem><FormLabel>Puerto SSH</FormLabel><FormControl><Input type="number" placeholder="22" {...field} disabled={isAddingServer} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={isAddingServer}>{isAddingServer ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Añadiendo...</>) : (<><PlusCircle className="mr-2 h-4 w-4" /> Añadir Servidor</>)}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ServerListItem({ server, onDeleteServer, onSelectServerForDetails, userRole }: { server: RegisteredServer; onDeleteServer: (serverId: string) => void; onSelectServerForDetails: (server: RegisteredServer) => void; userRole: 'user' | 'admin' | 'super_admin' | null }) {
  const [isLogOpen, setIsLogOpen] = useState(false);
  const isSuperAdmin = userRole === 'super_admin';

  const getStatusIndicator = () => {
    switch (server.status) {
      case 'pending':
      case 'provisioning':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'ready':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Collapsible open={isLogOpen} onOpenChange={setIsLogOpen}>
      <div className="border p-4 rounded-md bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 flex items-center justify-center w-5 h-5"> {/* Wrapper for icon */}
            {getStatusIndicator()}
          </div>
          <div className="flex flex-col justify-center"> {/* Wrapper for text */}
            <h4 className="font-semibold">{server.name || 'Servidor sin nombre'}</h4>
            <p className="text-sm text-muted-foreground">IP: {server.ip_address}{server.ssh_port ? `:${server.ssh_port}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(server.status === 'provisioning' || server.status === 'failed') && server.provisioning_log && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" title={isLogOpen ? "Ocultar log" : "Mostrar log"} className="h-8 w-8">
                {isLogOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          )}
          <Button variant="outline" size="icon" onClick={() => onSelectServerForDetails(server)} title="Ver detalles" disabled={server.status !== 'ready'} className="h-8 w-8">
            <Info className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="h-8 w-8" title="Eliminar servidor" disabled={!isSuperAdmin}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar este servidor?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará el servidor "{server.name || server.ip_address}" de la lista.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteServer(server.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <CollapsibleContent>
        <div className="mt-2 border rounded-md overflow-hidden">
          <div className="max-h-[400px] overflow-auto">
            <SyntaxHighlighter 
              language="bash" 
              style={vscDarkPlus} 
              customStyle={{ 
                margin: 0,
                padding: '1rem',
                fontSize: '0.875rem',
                lineHeight: '1.25rem',
              }} 
              codeTagProps={{ 
                style: { 
                  fontFamily: 'var(--font-geist-mono)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                } 
              }}
              wrapLines={true}
              wrapLongLines={true}
            >
              {server.provisioning_log || 'No hay logs disponibles.'}
            </SyntaxHighlighter>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ServerListTab() {
  const { userRole } = useSession(); // Get user role
  const [servers, setServers] = useState<RegisteredServer[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(true);
  const [selectedServer, setSelectedServer] = useState<RegisteredServer | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const POLLING_INTERVAL = 5000; // 5 seconds

  const fetchServers = useCallback(async () => {
    try {
      const response = await fetch(DEEPCODER_API_BASE_PATH);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: RegisteredServer[] = await response.json();
      setServers(data);
    } catch (error: any) {
      console.error('Error fetching servers:', error);
      toast.error(`Error al cargar los servidores: ${error.message}`);
    } finally {
      setIsLoadingServers(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    const interval = setInterval(() => {
      setServers(currentServers => {
        const isProvisioning = currentServers.some(s => s.status === 'pending' || s.status === 'provisioning');
        if (isProvisioning) {
          fetchServers();
        }
        return currentServers;
      });
    }, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchServers]);

  const handleDeleteServer = async (serverId: string) => {
    try {
      const response = await fetch(`${DEEPCODER_API_BASE_PATH}?id=${serverId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP error! status: ${response.status}`);
      toast.success(result.message || 'Servidor eliminado correctamente.');
      fetchServers();
    } catch (error: any) {
      console.error('Error deleting server:', error);
      toast.error(`Error al eliminar el servidor: ${error.message}`);
    }
  };

  const handleSelectServerForDetails = (server: RegisteredServer) => {
    setSelectedServer(server);
    setIsDetailDialogOpen(true);
  };

  return (
    <div className="space-y-8 h-full overflow-y-auto p-1">
      <AddServerForm onServerAdded={fetchServers} />
      <Separator />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-6 w-6" /> Servidores Registrados</CardTitle></CardHeader>
        <CardContent>
          {isLoadingServers && servers.length === 0 ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando servidores...</p></div>
          ) : servers.length === 0 ? (
            <p className="text-muted-foreground">No hay servidores registrados aún.</p>
          ) : (
            <div className="space-y-4">
              {servers.map((server) => (
                <ServerListItem key={server.id} server={server} onDeleteServer={handleDeleteServer} onSelectServerForDetails={handleSelectServerForDetails} userRole={userRole} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {selectedServer && <ServerDetailDialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen} server={selectedServer} userRole={userRole} />}
    </div>
  );
}