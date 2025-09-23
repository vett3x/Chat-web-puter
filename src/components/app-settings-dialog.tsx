"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from '@/components/session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
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
import { Loader2, Save, KeyRound, Trash2, Gauge, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// Schemas para los formularios
const changePasswordSchema = z.object({
  new_password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

interface AppSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
  onAiResponseSpeedChange: (speed: 'slow' | 'normal' | 'fast') => void;
  noteFontSize: number;
  onNoteFontSizeChange: (size: number) => void;
  noteAutoSave: boolean;
  onNoteAutoSaveChange: (enabled: boolean) => void;
}

export function AppSettingsDialog({
  open,
  onOpenChange,
  aiResponseSpeed,
  onAiResponseSpeedChange,
  noteFontSize,
  onNoteFontSizeChange,
  noteAutoSave,
  onNoteAutoSaveChange,
}: AppSettingsDialogProps) {
  const { session, isLoading: isSessionLoading } = useSession();
  const router = useRouter();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      new_password: '',
    },
  });

  useEffect(() => {
    if (open && !isSessionLoading && !session) {
      onOpenChange(false);
      router.push('/login');
    }
  }, [session, isSessionLoading, router, open, onOpenChange]);

  const handleChangePassword = async (values: ChangePasswordFormValues) => {
    if (!session?.user?.id) return;

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.new_password,
      });

      if (error) throw error;

      toast.success('Contraseña actualizada correctamente.');
      passwordForm.reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error changing password:', error.message);
      toast.error(`Error al cambiar la contraseña: ${error.message}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session?.user?.id) return;

    setIsDeletingAccount(true);
    try {
      await supabase.auth.signOut();
      toast.success('Tu cuenta ha sido marcada para eliminación. Se cerrará tu sesión.');
      router.push('/login');
    } catch (error: any) {
      console.error('Error deleting account:', error.message);
      toast.error(`Error al eliminar la cuenta: ${error.message}`);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isSessionLoading || !session) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader>
          <DialogTitle>Configuración de la Aplicación</DialogTitle>
          <DialogDescription>Gestiona las opciones generales de tu aplicación.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          {/* Change Password Section */}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
              <KeyRound className="h-5 w-5 text-muted-foreground" /> Cambiar Contraseña
            </h3>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="new_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isChangingPassword} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Actualizar Contraseña
                </Button>
              </form>
            </Form>
          </div>

          <Separator />

          {/* AI Response Speed Section */}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
              <Gauge className="h-5 w-5 text-muted-foreground" /> Velocidad de Respuesta de la IA
            </h3>
            <RadioGroup value={aiResponseSpeed} onValueChange={(value: 'slow' | 'normal' | 'fast') => onAiResponseSpeedChange(value)} className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2"><RadioGroupItem value="slow" id="speed-slow" /><Label htmlFor="speed-slow">Lenta</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="normal" id="speed-normal" /><Label htmlFor="speed-normal">Normal</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="fast" id="speed-fast" /><Label htmlFor="speed-fast">Rápida</Label></div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Note Settings Section */}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" /> Configuración de Notas
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="note-font-size">Tamaño de Fuente del Editor</Label>
                <Input
                  id="note-font-size"
                  type="number"
                  value={noteFontSize}
                  onChange={(e) => onNoteFontSizeChange(Number(e.target.value))}
                  className="w-20"
                  min={10}
                  max={24}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="note-auto-save">Guardado Automático</Label>
                <Switch
                  id="note-auto-save"
                  checked={noteAutoSave}
                  onCheckedChange={onNoteAutoSaveChange}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Delete Account Section */}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 text-destructive">
              <Trash2 className="h-5 w-5" /> Eliminar Cuenta
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esta acción es irreversible. Todos tus datos de usuario y conversaciones serán eliminados permanentemente.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" disabled={isDeletingAccount}>{isDeletingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Eliminar mi cuenta</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Esto eliminará permanentemente tu cuenta y todos tus datos.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sí, eliminar mi cuenta</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}