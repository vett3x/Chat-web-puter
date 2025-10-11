"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ContactForm } from './ContactForm';

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDialog({ open, onOpenChange }: ContactDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-black/50 backdrop-blur-lg border-white/20 text-white">
        <DialogHeader>
          <DialogTitle>Contáctanos</DialogTitle>
          <DialogDescription>
            Envíanos un mensaje y nos pondremos en contacto contigo pronto.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ContactForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}