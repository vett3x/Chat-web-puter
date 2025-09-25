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
const BUILD_NUMBER = "665"; // Updated build number

interface UpdateManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UpdateCheckResponse {
  updateAvailable: boolean;
  localPackageVersion: string; // Changed from localCommit
  remotePackageVersion: string; // Changed from remoteCommit
  // Removed newCommits
}

export function UpdateManagerDialog({ open, onOpenChange }: UpdateManagerDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [logOutput, setLogOutput] = useState<string>('Listo para comprobar si hay actualizaciones...');
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);

  const handleCheckForUpdates = async () => {
    setIsLoading(true);
    setLogOutput('Comprobando actualizaciones desde el repositorio de GitHub...');
    setUpdateInfo(null);
    try {
      const response = await fetch('/api/app-update?action=check');
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setUpdateInfo(result);
      if (result.updateAvailable) {
        setLogOutput(`¡Actualización disponible!\n\nVersión local (package.json): ${result.localPackageVersion}\nVersión remota (package.json): ${result.remotePackageVersion}`);
      } else {
        setLogOutput(`Ya estás en la última versión.\n\nVersión local (package.json): ${result.localPackageVersion}\nVersión remota (package.json): ${result.remotePackageVersion}`);
      }
    } catch (error: any) {
      toast.error('Error al comprobar las actualizaciones.');
      setLogOutput(`Error: ${error.message}`);
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

      setLogOutput(result.output);
      toast.success('Actualización completada. La aplicación se reiniciará.');
      // The app will likely restart, so we might not see the final state.
      // We can try to reload the page after a delay.
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
            {updateInfo && (
              <>
                <p>Versión Local (package.json): <span className="font-mono text-xs bg-muted p-1 rounded">{updateInfo.localPackageVersion}</span></p>
                <p>Versión Remota (package.json): <span className="font-mono text-xs bg-muted p-1 rounded">{updateInfo.remotePackageVersion}</span></p>
              </>
            )}
          </div>
          <div className="w-full bg-black text-white font-mono text-xs rounded-md p-4 h-64 overflow-y-auto">
            <pre className="whitespace-pre-wrap">{logOutput}</pre>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCheckForUpdates} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
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