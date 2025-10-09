"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Image as ImageIcon, Upload, Save, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export function PersonalizationTab() {
  const [currentBackgroundUrl, setCurrentBackgroundUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/personalization');
      if (!response.ok) throw new Error('No se pudo cargar la configuración.');
      const data = await response.json();
      setCurrentBackgroundUrl(data.login_background_url);
      setPreviewUrl(data.login_background_url);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecciona un archivo de imagen.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('La imagen no debe exceder los 5MB.');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!selectedFile) {
      toast.info('No has seleccionado una nueva imagen para guardar.');
      return;
    }
    setIsSaving(true);
    const formData = new FormData();
    formData.append('login_background', selectedFile);

    try {
      const response = await fetch('/api/admin/personalization', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Fondo de inicio de sesión actualizado.');
      setSelectedFile(null);
      fetchSettings();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/personalization', { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Fondo de inicio de sesión eliminado.');
      setSelectedFile(null);
      fetchSettings();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 p-1">
      <Card>
        <CardHeader>
          <CardTitle>Página de Inicio de Sesión</CardTitle>
          <CardDescription>Personaliza la apariencia de la página de inicio de sesión.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" hidden />
          <div>
            <h4 className="text-sm font-medium mb-2">Fondo de Pantalla</h4>
            <div className="border rounded-lg p-4 space-y-4">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                <div className="relative w-full h-48 bg-muted rounded-md overflow-hidden">
                  {previewUrl ? (
                    <Image src={previewUrl} alt="Vista previa del fondo" layout="fill" objectFit="cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ImageIcon className="h-10 w-10 mb-2" />
                      <p>Sin fondo personalizado</p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                  <Upload className="mr-2 h-4 w-4" /> Cambiar Imagen
                </Button>
                <Button onClick={handleSave} disabled={!selectedFile || isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar
                </Button>
                <Button variant="destructive" onClick={handleRemove} disabled={!currentBackgroundUrl || isSaving}>
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar Fondo
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}