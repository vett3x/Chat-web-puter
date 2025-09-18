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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User as UserIcon, Upload, XCircle, Save } from 'lucide-react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

const profileFormSchema = z.object({
  first_name: z.string().max(50, { message: 'El nombre no puede exceder los 50 caracteres.' }).optional(),
  last_name: z.string().max(50, { message: 'El apellido no puede exceder los 50 caracteres.' }).optional(),
  avatar_file: z.any().optional() // For file upload
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  const { session, isLoading: isSessionLoading } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<{ first_name: string | null; last_name: string | null; avatar_url: string | null } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
    },
  });

  // Redirect if not authenticated and dialog is open
  useEffect(() => {
    if (open && !isSessionLoading && !session) {
      onOpenChange(false); // Close dialog
      router.push('/login');
    }
  }, [session, isSessionLoading, router, open, onOpenChange]);

  const fetchProfile = useCallback(async () => {
    if (session?.user?.id) {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast.error('Error al cargar el perfil del usuario.');
      } else {
        setProfile(data);
        form.reset({
          first_name: data?.first_name || '',
          last_name: data?.last_name || '',
        });
        setAvatarPreview(data?.avatar_url || null);
      }
    }
  }, [session, form]);

  useEffect(() => {
    if (open && session?.user?.id) {
      fetchProfile();
    }
  }, [open, session, fetchProfile]);

  const getInitials = (firstName: string | null | undefined, lastName: string | null | undefined) => {
    const first = firstName ? firstName.charAt(0) : '';
    const last = lastName ? lastName.charAt(0) : '';
    return (first + last).toUpperCase() || 'US';
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('El archivo de imagen no debe exceder los 5MB.');
        setAvatarFile(null);
        setAvatarPreview(profile?.avatar_url || null);
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      setAvatarFile(null);
      setAvatarPreview(profile?.avatar_url || null);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!session?.user?.id) return;

    setIsUploading(true);
    try {
      // Delete from storage if an avatar_url exists and it's a Supabase URL
      if (profile?.avatar_url && profile.avatar_url.includes(supabase.storage.from('avatars').getPublicUrl('').data.publicUrl)) {
        const path = profile.avatar_url.split('/').pop(); // Get filename from URL
        if (path) {
          const { error: deleteError } = await supabase.storage.from('avatars').remove([`${session.user.id}/${path}`]);
          if (deleteError) {
            console.error('Error deleting old avatar:', deleteError);
            // Don't block if delete fails, proceed with updating profile
          }
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', session.user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success('Avatar eliminado correctamente.');
    } catch (error: any) {
      console.error('Error removing avatar:', error.message);
      toast.error('Error al eliminar el avatar.');
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!session?.user?.id) return;

    setIsUploading(true);
    let newAvatarUrl: string | null = profile?.avatar_url || null; // Ensure it's string | null

    try {
      // Handle avatar file upload
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`;

        // Upload new avatar
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        newAvatarUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl || null; // Ensure it's string | null
      }

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          avatar_url: newAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setProfile(prev => ({
        ...prev!,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        avatar_url: newAvatarUrl,
      }));
      setAvatarFile(null); // Clear file input after successful upload
      toast.success('Perfil actualizado correctamente.');
      onOpenChange(false); // Close dialog on successful save
    } catch (error: any) {
      console.error('Error updating profile:', error.message);
      toast.error(`Error al actualizar el perfil: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (isSessionLoading || !session) {
    return null; // Don't render dialog content if session is loading or not present
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader>
          <DialogTitle>Configuración de Perfil</DialogTitle>
          <DialogDescription>Actualiza tu información personal y avatar.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative w-24 h-24">
                  <Avatar className="w-24 h-24">
                    {avatarPreview ? (
                      <AvatarImage src={avatarPreview} alt="Avatar" />
                    ) : (
                      <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                        {getInitials(profile?.first_name, profile?.last_name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  {avatarPreview && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-background/70 hover:bg-background text-destructive hover:text-destructive-foreground"
                      onClick={handleRemoveAvatar}
                      disabled={isUploading}
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="avatar_file"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('avatar_file')?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="mr-2 h-4 w-4" /> Subir Avatar
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu nombre" {...field} disabled={isUploading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu apellido" {...field} disabled={isUploading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isUploading}>Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}