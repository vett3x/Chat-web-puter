"use client";

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  action: 'expulsar' | 'banear';
  onSubmit: (reason: string) => void;
}

export function ReasonDialog({ open, onOpenChange, userName, action, onSubmit }: ReasonDialogProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (reason.trim()) {
      onSubmit(reason);
      onOpenChange(false);
      setReason('');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro de que quieres {action} a {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Por favor, proporciona una razón para esta acción. Quedará registrada en el historial del sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="reason">Razón</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`Motivo para ${action} al usuario...`}
            className="mt-2"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason('')}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={!reason.trim()}>
            Confirmar y {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}