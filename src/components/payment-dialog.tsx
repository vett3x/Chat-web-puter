"use client";

import React from 'react';
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
import { PayPalButtonsWrapper } from './paypal-buttons-wrapper';
import { Check } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  price_period: string | null;
  features: string[];
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PricingPlan | null;
}

export function PaymentDialog({ open, onOpenChange, plan }: PaymentDialogProps) {
  if (!plan) return null;

  const handlePaymentSuccess = () => {
    onOpenChange(false);
    // You can add further logic here, like redirecting to a thank you page
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Confirmar tu Plan: {plan.name}</DialogTitle>
          <DialogDescription>
            Estás a punto de suscribirte al plan {plan.name}. Revisa los detalles y completa el pago a continuación.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-semibold">Total a pagar:</span>
            <span className="text-2xl font-bold">{plan.price}<span className="text-base font-normal text-muted-foreground">{plan.price_period}</span></span>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <PayPalButtonsWrapper plan={plan} onPaymentSuccess={handlePaymentSuccess} />
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}