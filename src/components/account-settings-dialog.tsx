"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Save, KeyRound, Trash2, Gauge, BrainCircuit } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AI_PROVIDERS, getModelLabel } from '@/lib/ai-models';
import { ApiKey } from '@/hooks/use-user-api-keys';

// Schemas para los formularios
const changePasswordSchema = z.object({
  new_password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

const defaultModelSchema = z.object({
  default_ai_model: z.string().min(1, { message: 'Debes seleccionar un modelo por defecto.' }),
});

type DefaultModelFormValues = z.infer<typeof defaultModelSchema>;

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
  onAiResponseSpeedChange: (speed: 'slow' | 'normal' | 'fast') => void;
  userApiKeys: ApiKey[];
  isLoadingApiKeys: boolean;
  currentUserRole: 'user' | 'admin' | 'super_admin' | null;
}

export function AccountSettingsDialog({
  open,
  onOpenChange,
  aiResponseSpeed,
  onAiResponseSpeedChange,
  userApiKeys,
  isLoadingApiKeys,
  currentUserRole,
}: AccountSettingsDialogProps) {
  const { session, isLoading: isSessionLoading } = useSession();
  const router = useRouter();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSavingDefaultModel, setIsSavingDefaultModel] = useState(false);

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      new_password: '',
    },
  });

  const defaultModelForm = useForm<DefaultModelFormValues>({
    resolver: zodResolver(defaultModelSchema),
    defaultValues: {
      default_ai_model: '',
    },
  });

  // Determine available models for the dropdown
  const availableModels = React.useMemo(() => {
    const models: { value: string; label: string; isGlobal?: boolean }[] = [];

    // Add Puter.js models
    AI_PROVIDERS.filter(p => p.source === 'puter').forEach(provider => {
      provider.models.forEach(model => {
        models.push({ value: `puter:${model.value}`, label: `${provider.company}: ${model.label}` });
      });
    });

    // Add user API keys
    userApiKeys.forEach(key => {
      let label = '';
      if (key.provider === 'custom_endpoint') {
        label = key.nickname || `Endpoint Personalizado (${key.id.substring(0, 8)}...)`;
      } else if (key.nickname) {
        label = key.nickname;
      } else {
        const providerName = AI_PROVIDERS.find(p => p.value === key.provider)?.company || key.provider;
        const modelLabel = key.model_name ? getModelLabel(key.model_name, userApiKeys) : 'Modelo no seleccionado';
        if (key.use_vertex_ai) {
          label = `${providerName} (Vertex AI): ${modelLabel}`;
        } else {
          label = `${providerName}: ${modelLabel}`;
        }
      }
      if (key.is_global) {
        label += ' (Global)';
      }
      models.push({ value: `user_key:${key.id}`, label, isGlobal: key.is_global });
    });

    return models;
  }, [userApiKeys]);

  // Determine initial default model value
  useEffect(() => {
    if (!isLoadingApiKeys && availableModels.length > 0) {
      const storedDefaultModel = typeof window !== 'undefined' ? localStorage.getItem('default_ai_model') : null;
      let initialDefault = '';

      if (storedDefaultModel && availableModels.some(m => m.value === storedDefaultModel)) {
        initialDefault = storedDefaultModel;
      } else {
        // Prioritize global keys
        const globalKey = availableModels.find(m => m.isGlobal);
        if (globalKey) {
          initialDefault = globalKey.value;
        } else {
          // Then prioritize Claude models
          const claudeModel = availableModels.find(m => m.value.startsWith('puter:claude'));
          if (claudeModel) {
            initialDefault = claudeModel.value;
          } else if (availableModels.length > 0) {
            // Fallback to the first available model
            initialDefault = availableModels[0].value;
          }
        }
      }
      defaultModelForm.reset({ default_ai_model: initialDefault });
    }
  }, [isLoadingApiKeys, availableModels, defaultModelForm]);


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

  const handleSaveDefaultModel = async (values: DefaultModelFormValues) => {
    setIsSavingDefaultModel(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('default_ai_model', values.default_ai_model);
      }
      toast.success('Modelo de IA por defecto guardado.');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving default AI model:', error.message);
      toast.error(`Error al guardar el modelo por defecto: ${error.message}`);
    } finally {
      setIsSavingDefaultModel(false);
    }
  };

  if (isSessionLoading || !session) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader>
          <DialogTitle>Configuración de Cuenta</DialogTitle>
          <DialogDescription>Gestiona las opciones generales de tu cuenta y preferencias de IA.</DialogDescription>
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

          {/* Default AI Model Section */}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
              <BrainCircuit className="h-5 w-5 text-muted-foreground" /> Modelo de IA por Defecto
            </h3>
            <Form {...defaultModelForm}>
              <form onSubmit={defaultModelForm.handleSubmit(handleSaveDefaultModel)} className="space-y-4">
                <FormField
                  control={defaultModelForm.control}
                  name="default_ai_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seleccionar Modelo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSavingDefaultModel || isLoadingApiKeys || availableModels.length === 0}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un modelo de IA por defecto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSavingDefaultModel || isLoadingApiKeys || availableModels.length === 0}>
                  {isSavingDefaultModel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar Modelo por Defecto
                </Button>
              </form>
            </Form>
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