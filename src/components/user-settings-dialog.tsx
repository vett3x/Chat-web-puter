"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { LanguageSelector } from './language-selector';
import { Label } from '@/components/ui/label';

interface UserSettingsDialogProps {
  children?: React.ReactNode;
}

export function UserSettingsDialog({ children }: UserSettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configuración de Usuario</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="language">Idioma del Editor</Label>
            <LanguageSelector />
            <p className="text-xs text-muted-foreground">
              Cambia el idioma de la interfaz del editor de notas. Los cambios se aplicarán inmediatamente.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}