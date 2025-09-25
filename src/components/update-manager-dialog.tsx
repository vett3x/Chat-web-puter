"use client";

import React, { useState } from 'react';
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
import { Loader2, GitPullRequest, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
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

const APP_VERSION = "v0.4b Stable";
const BUILD_NUMBER = "674"; // Updated build number

interface UpdateManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UpdateCheckResponse {
  updateAvailable: boolean;
  localPackageVersion: string;
  remotePackageVersion: string;
  localCommitHash: string;
  remoteCommitHash: string;
  newCommits: string[];
}

export function UpdateManagerDialog({ open, onOpenChange }: UpdateManagerDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [logOutput, setLogOutput] = useState<string>(''); // Initialize as empty string
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);

  const handleCheckForUpdates = async () => {
    setIsLoading(true);
    setLogOutput(''); // Clear previous log output
    setUpdateInfo(null); // Clear previous update info
    try {
      const response = await fetch('/api/app-update?action=check');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      const typedResult: UpdateCheckResponse = result;
      setUpdateInfo(typedResult);
      setLogOutput(''); // Ensure logOutput is empty on success
    } catch (error: any) {
      toast.error('Error al comprobar las actualizaciones.');
      setLogOutput(`Error: ${error.message}`); // Set error in logOutput
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceUpdate = async () => {
    setIsLoading(true);
    setLogOutput('Iniciando actualización forzada...');
    try {
      const response = await fetch('/api/app-update?action=force', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setLogOutput(result.output); // This output is already filtered for Dyad commits
      toast.success('Actualización completada. La aplicación se reiniciará.');
      setTimeout(() => window.location.reload(), 5000);
    } catch (error: any) {
      toast.error('Error durante la actualización.');
      setLogOutput(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequest className="h-6 w-6" /> Gestor de Actualizaciones
          </DialogTitle>
          <DialogDescription>
            Comprueba y aplica actualizaciones para la aplicación directamente desde el repositorio de GitHub.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="text-sm">
            <p>Versión Actual: <span className="font-semibold">{APP_VERSION} (Compilación {BUILD_NUMBER})</span></p>
            {isLoading && !updateInfo && !logOutput ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Comprobando actualizaciones...</p>
              </div>
            ) : updateInfo ? (
              <>
                <p>Versión Local (package.json): <span className="font-mono text-xs bg-muted p-1 rounded">{updateInfo.localPackageVersion}</span></p>
                <p>Versión Remota (package.json): <span className="font-mono text-xs bg-muted p-1 rounded">{updateInfo.remotePackageVersion}</span></p>
                <p>Commit Local: <span className="font-mono text-xs bg-muted p-1 rounded">{updateInfo.localCommitHash}</span></p>
                <p>Commit Remoto: <span className="font-mono text-xs bg-muted p-1 rounded">{updateInfo.remoteCommitHash}</span></p>
              </>
            ) : (
              <p className="text-muted-foreground mt-2">Haz clic en "Comprobar Actualizaciones" para empezar.</p>
            )}
          </div>
          {updateInfo?.updateAvailable && updateInfo.newCommits.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold mb-2">Nuevos commits:</p>
              <div className="w-full bg-black text-white font-mono text-xs rounded-md p-4 max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap">
                  {updateInfo.newCommits.join('\n')}
                </pre>
              </div>
            </div>
          )}
          {/* The logOutput is now primarily for POST action or GET errors */}
          {logOutput && (
            <div className="w-full bg-black text-white font-mono text-xs rounded-md p-4 h-64 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{logOutput}</pre>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleCheckForUpdates} disabled={isLoading}>
              {isLoading && !updateInfo && !logOutput ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Comprobar Actualizaciones
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isLoading || !updateInfo?.updateAvailable}>
                  <GitPullRequest className="mr-2 h-4 w-4" /> Forzar Actualización
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro de forzar la actualización?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción descargará los últimos cambios del repositorio, instalará las dependencias y reconstruirá la aplicación. El servidor se reiniciará y puede que no esté disponible durante unos momentos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleForceUpdate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sí, actualizar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}