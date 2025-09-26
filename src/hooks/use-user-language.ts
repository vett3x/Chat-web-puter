"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';

export function useUserLanguage() {
  const { session } = useSession();
  const [language, setLanguage] = useState<string>('es');
  const [isLoading, setIsLoading] = useState(true);

  // Cargar el idioma del usuario
  useEffect(() => {
    const fetchUserLanguage = async () => {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Error fetching user language:', error);
          setLanguage('es'); // Fallback a español
        } else {
          setLanguage(data.language || 'es');
        }
      } catch (error) {
        console.error('Error fetching user language:', error);
        setLanguage('es');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserLanguage();
  }, [session?.user?.id]);

  // Función para actualizar el idioma
  const updateLanguage = async (newLanguage: string) => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ language: newLanguage })
        .eq('id', session.user.id);

      if (error) {
        toast.error('Error al actualizar el idioma');
        console.error('Error updating language:', error);
      } else {
        setLanguage(newLanguage);
        toast.success('Idioma actualizado correctamente');
      }
    } catch (error) {
      toast.error('Error al actualizar el idioma');
      console.error('Error updating language:', error);
    }
  };

  return {
    language,
    updateLanguage,
    isLoading,
  };
}