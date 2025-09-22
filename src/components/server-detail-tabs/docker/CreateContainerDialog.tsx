"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, XCircle, ScrollText, ChevronDown, ChevronRight } from 'lucide-react'; // Import ScrollText, ChevronDown, ChevronRight
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'; // Import Collapsible components
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // Import SyntaxHighlighter
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Import theme

interface CloudflareDomain {
  id: string;
  domain_name: string;
  zone_id: string;
  account_id: string;
}

const createContainerFormSchema = z.object({
  image: z.string().min(1, { message: 'La imagen es requerida.' }),
  name: z.string().optional(),
  cloudflare_domain_id: z.string().uuid({ message: 'ID de dominio de Cloudflare inválido.' }).optional(),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }).optional(),
  host_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto del host inválido.' }).optional(),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
  script_install_deps: z.string().min(1, { message: 'El script de instalación de dependencias es requerido.' }), // New field for script
});
type CreateContainerFormValues = z.infer<typeof createContainerFormSchema>;

const DEFAULT_INSTALL_DEPS_SCRIPT = `
set -ex # -e: exit on error, -x: print commands and arguments as they are executed
export DEBIAN_FRONTEND=noninteractive

echo "--- Initial apt update... ---"
apt-get update -y || { echo "ERROR: initial apt-get update failed"; exit 1; }
echo "--- Initial apt update complete. ---"

echo "--- Installing sudo... ---"
apt-get install -y sudo || { echo "ERROR: sudo installation failed"; exit 1; }
echo "--- sudo installed. ---"

echo "--- Installing core dependencies (curl, gnupg, lsb-release, apt-utils)..."
sudo apt-get install -y curl gnupg lsb-release apt-utils || { echo "ERROR: core dependencies installation failed"; exit 1; }
echo "--- Core dependencies installed. ---"

echo "--- Installing Node.js and npm... ---"
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash - || { echo "ERROR: Node.js setup script failed"; exit 1; }
sudo apt-get install -y nodejs || { echo "ERROR: Node.js installation failed"; exit 1; }
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo "--- Node.js and npm installed. ---"

echo "--- Installing cloudflared... ---"
# Add cloudflare gpg key
sudo mkdir -p --mode=0755 /usr/share/keyrings || { echo "ERROR: mkdir /usr/share/keyrings failed"; exit 1; }
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null || { echo "ERROR: adding cloudflare gpg key failed"; exit 1; }
chmod a+r /usr/share/keyrings/cloudflare-main.gpg # Ensure correct permissions

# Add this repo to your apt repositories
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null || { echo "ERROR: adding cloudflared repo failed"; exit 1; }

# install cloudflared
sudo apt-get update -y && sudo apt-get install -y cloudflared || { echo "ERROR: cloudflared installation failed"; exit 1; }

echo "--- Verifying cloudflared installation ---"
which cloudflared || { echo "ERROR: cloudflared binary not found in PATH"; exit 1; }
cloudflared --version || { echo "ERROR: cloudflared --version command failed"; exit 1; }
echo "--- cloudflared installed and verified. ---"

echo "--- Creating Next.js 'hello-world' app in /app directory... ---"
# Run as root, so no sudo needed here. Use --yes to skip prompts.
cd /
npx --yes create-next-app@latest app --use-npm --example "https://github.com/vercel/next.js/tree/canary/examples/hello-world" || { echo "ERROR: create-next-app failed"; exit 1; }
echo "--- Next.js app created. ---"

echo "--- Installing Next.js app dependencies... ---"
cd /app
npm install || { echo "ERROR: npm install failed"; exit 1; }
echo "--- Dependencies installed. ---"

echo "--- Starting Next.js dev server in the background... ---"
# Run the dev server in the background using nohup and redirect output
# The __CONTAINER_PORT__ placeholder will be replaced by the backend with the correct port.
nohup npm run dev -- -p __CONTAINER_PORT__ > /app/dev.log 2>&1 &
echo "--- Next.js dev server started. Check /app/dev.log for output. ---"

echo "--- Container dependency installation complete ---"
`;

const TUNNEL_CREATION_SUMMARY_SCRIPT = `
# Resumen de la secuencia de creación del túnel Cloudflare (ejecutado en el backend)

# 1. Verificar túneles existentes para el contenedor y puerto.
# 2. Crear un nuevo túnel Cloudflare a través de la API de Cloudflare.
#    - Se genera un ID de túnel y un token.
# 3. Generar un subdominio (si no se proporciona) y construir el dominio completo.
# 4. Crear un registro DNS CNAME en Cloudflare apuntando el dominio completo al túnel.
# 5. Guardar los detalles del túnel en la base de datos (tabla 'docker_tunnels').
# 6. Configurar las reglas de ingreso del túnel a través de la API de Cloudflare:
#    - Redirige el tráfico del dominio completo a 'http://localhost:[PUERTO_CONTENEDOR]'.
#    - Se mantiene 'noTLSVerify: true' para la conexión interna, por si el origen fuera HTTPS con certificado auto-firmado.
# 7. Instalar y ejecutar el cliente 'cloudflared' dentro del contenedor Docker:
#    - Se crea el directorio '/root/.cloudflared'.
#    - Se escriben los archivos de credenciales y configuración ('config.yml') del túnel.
#    - Se ejecuta 'cloudflared tunnel run [ID_TUNNEL]' en segundo plano dentro del contenedor.
# 8. Actualizar el estado del túnel a 'activo' en la base de datos.
# 9. Registrar el evento de creación del túnel en el historial del servidor.

# En caso de fallo en cualquier paso, se intenta revertir las acciones realizadas (eliminar túnel, registro DNS, etc.).
`;


const INITIAL_CREATE_CONTAINER_DEFAULTS: CreateContainerFormValues = {
  image: 'ubuntu:latest',
  name: '',
  cloudflare_domain_id: undefined,
  container_port: 3000,
  host_port: undefined,
  subdomain: undefined,
  script_install_deps: DEFAULT_INSTALL_DEPS_SCRIPT, // Set default script
};

interface CreateContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  onContainerCreated: () => void;
  canManageDockerContainers: boolean;
  canManageCloudflareTunnels: boolean;
}

export function CreateContainerDialog({ open, onOpenChange, serverId, onContainerCreated, canManageDockerContainers, canManageCloudflareTunnels }: CreateContainerDialogProps) {
  const [isCreatingContainer, setIsCreatingContainer] = useState(false);
  const [cloudflareDomains, setCloudflareDomains] = useState<CloudflareDomain[]>([]);
  const [isLoadingCloudflareDomains, setIsLoadingCloudflareDomains] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0: initial, 1: starting, 2: creating container, 3: installing node, 4: configuring tunnel
  const [containerInstallLog, setContainerInstallLog] = useState<string | null>(null); // NEW STATE
  const [isInstallLogOpen, setIsInstallLogOpen] = useState(false); // NEW STATE for collapsible

  const form = useForm<CreateContainerFormValues>({
    resolver: zodResolver(createContainerFormSchema),
    defaultValues: INITIAL_CREATE_CONTAINER_DEFAULTS,
  });

  const fetchCloudflareDomains = useCallback(async () => {
    setIsLoadingCloudflareDomains(true);
    try {
      const response = await fetch('/api/cloudflare/domains', { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: CloudflareDomain[] = await response.json();
      setCloudflareDomains(data);
    } catch (err: any) {
      console.error('Error fetching Cloudflare domains:', err);
      toast.error('Error al cargar los dominios de Cloudflare.');
    } finally {
      setIsLoadingCloudflareDomains(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchCloudflareDomains();
      form.reset(INITIAL_CREATE_CONTAINER_DEFAULTS);
      setStatusMessage(null);
      setCurrentStep(0);
      setContainerInstallLog(null); // RESET NEW STATE
      setIsInstallLogOpen(false); // RESET NEW STATE
    }
  }, [open, fetchCloudflareDomains, form]);

  useEffect(() => {
    if (open && !isLoadingCloudflareDomains && cloudflareDomains.length > 0 && canManageCloudflareTunnels) {
      if (!form.getValues('cloudflare_domain_id')) {
        form.setValue('cloudflare_domain_id', cloudflareDomains[0].id, { shouldValidate: true });
      }
    } else if (open && !isLoadingCloudflareDomains && cloudflareDomains.length === 0) {
      form.setValue('cloudflare_domain_id', undefined, { shouldValidate: true });
    }
  }, [open, isLoadingCloudflareDomains, cloudflareDomains, canManageCloudflareTunnels, form]);

  const handleCreateContainer: SubmitHandler<CreateContainerFormValues> = async (values) => {
    setIsCreatingContainer(true);
    setStatusMessage({ message: 'Iniciando creación del contenedor...', type: 'info' });
    setCurrentStep(1);
    setContainerInstallLog(null); // Clear previous log

    try {
      // Step 2: Create Container (API call handles container creation AND Node.js installation)
      setStatusMessage({ message: 'Verificando imagen Docker, creando contenedor e instalando Node.js/npm...', type: 'info' });
      setCurrentStep(2); // This step now covers container creation and Node.js installation
      const response = await fetch(`/api/servers/${serverId}/docker/containers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, framework: 'nextjs' }),
      });
      const result = await response.json();
      if (!response.ok) {
        setContainerInstallLog(result.installLog || null); // Capture log on error too
        throw new Error(result.message || 'Error al crear el contenedor.');
      }
      
      setStatusMessage({ message: 'Contenedor creado y Node.js/npm instalados exitosamente.', type: 'success' });
      setCurrentStep(3); // Advance to next logical step after container+node setup
      setContainerInstallLog(result.installLog || null); // Capture log on success
      setIsInstallLogOpen(true); // Open log by default on success/completion

      // If tunnel details were provided and user has permissions, the tunnel creation
      // is initiated on the server-side within the same API call.
      if (values.cloudflare_domain_id && values.container_port && canManageCloudflareTunnels) {
        setStatusMessage({ message: 'Túnel Cloudflare iniciado (ver historial para detalles)...', type: 'info' });
        setCurrentStep(4); // New step for tunnel configuration
      }

      toast.success('Contenedor, Node.js/npm y túnel (si aplica) creados exitosamente.');
      onContainerCreated();
      onOpenChange(false); // Only close on success
      form.reset(INITIAL_CREATE_CONTAINER_DEFAULTS);
      
    } catch (error: any) {
      // The currentStep will be the last one set before the error.
      // The statusMessage will reflect the error.
      setStatusMessage({ message: `Error: ${error.message}`, type: 'error' });
      toast.error(error.message);
    } finally {
      setIsCreatingContainer(false);
    }
  };

  const renderStatusStep = (stepNumber: number, message: string, current: number, type: 'info' | 'success' | 'error') => {
    const isActive = current === stepNumber;
    const isCompleted = current > stepNumber;
    const isError = type === 'error' && isActive; // Only show error icon if this is the active (failed) step

    return (
      <div className="flex items-center gap-2 text-sm">
        {isError ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : isActive ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <div className="h-4 w-4 border rounded-full flex-shrink-0" />
        )}
        <span className={isError ? "text-destructive" : isCompleted ? "text-muted-foreground" : ""}>
          {message}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(newOpenState) => {
      if (isCreatingContainer && !newOpenState) {
        toast.info("Por favor, espera a que termine el proceso de creación.");
        return; // Don't close while creating
      }
      // When closing, reset the status message so it's clean on next open
      if (!newOpenState) {
        setStatusMessage(null);
        setContainerInstallLog(null); // RESET NEW STATE on close
        setIsInstallLogOpen(false); // RESET NEW STATE on close
      }
      onOpenChange(newOpenState);
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"> {/* Increased max-width and added scroll */}
        <DialogHeader>
          <DialogTitle>Crear Nuevo Contenedor Next.js</DialogTitle>
          <DialogDescription>Ejecuta un nuevo contenedor Docker preconfigurado para Next.js en este servidor.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreateContainer)} className="space-y-4 py-4">
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

            {/* New: Editable Script for Dependencies */}
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

            {/* New: Read-only Script for Tunnel Creation Summary */}
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

            {statusMessage && (
              <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                <h4 className="font-semibold">Progreso:</h4>
                {renderStatusStep(1, 'Iniciando proceso...', currentStep, statusMessage.type)}
                {renderStatusStep(2, 'Verificando imagen Docker, creando contenedor e instalando Node.js/npm...', currentStep, statusMessage.type)}
                {form.getValues('cloudflare_domain_id') && form.getValues('container_port') && canManageCloudflareTunnels && (
                  renderStatusStep(3, 'Configurando túnel Cloudflare...', currentStep, statusMessage.type)
                )}
                {statusMessage.type === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span>{statusMessage.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* New: Container Installation Log Section */}
            {containerInstallLog && (
              <Collapsible open={isInstallLogOpen} onOpenChange={setIsInstallLogOpen} className="space-y-2 p-4 border rounded-md bg-muted/50">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ScrollText className="h-5 w-5" /> Log de Instalación del Contenedor
                  </h4>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" title={isInstallLogOpen ? "Ocultar log" : "Mostrar log"} className="h-7 w-7">
                      {isInstallLogOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
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
                        {containerInstallLog}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isCreatingContainer}>Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isCreatingContainer || !canManageDockerContainers}>
                {isCreatingContainer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Contenedor Next.js
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}