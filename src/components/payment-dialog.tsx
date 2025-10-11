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
import { PayPalButtonsWrapper } from './paypal-buttons-wrapper';
import { Check, CreditCard, AlertCircle } from 'lucide-react';
import { PayPalPaymentForm } from './paypal-payment-form';
import { cn } from '@/lib/utils';
import { usePayPalConfig } from './paypal-provider';

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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const { isPayPalConfigured } = usePayPalConfig();

  if (!plan) return null;

  const handlePaymentSuccess = () => {
    onOpenChange(false);
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

        {!isPayPalConfigured ? (
          <div className="text-destructive text-sm text-center p-4 bg-destructive/10 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>Los pagos no están configurados correctamente. Verifica la configuración de PayPal en el panel de administración.</span>
          </div>
        ) : (
          <>
            <div className="flex border-b mb-4">
              <button
                onClick={() => setPaymentMethod('card')}
                className={cn(
                  "flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2",
                  paymentMethod === 'card' ? 'border-b-2 border-primary-light-purple text-primary-light-purple' : 'text-muted-foreground'
                )}
              >
                <CreditCard className="h-4 w-4" />
                Tarjeta
              </button>
              <button
                onClick={() => setPaymentMethod('paypal')}
                className={cn(
                  "flex-1 py-2 text-sm font-medium",
                  paymentMethod === 'paypal' ? 'border-b-2 border-primary-light-purple text-primary-light-purple' : 'text-muted-foreground'
                )}
              >
                PayPal
              </button>
            </div>

            {paymentMethod === 'card' && (
              <PayPalPaymentForm plan={plan} onPaymentSuccess={handlePaymentSuccess} />
            )}

            {paymentMethod === 'paypal' && (
              <div className="px-4">
                <p className="text-center text-sm text-muted-foreground mb-4">Serás redirigido a PayPal para completar tu compra de forma segura.</p>
                <PayPalButtonsWrapper plan={plan} onPaymentSuccess={handlePaymentSuccess} fundingSource="paypal" />
              </div>
            )}
          </>
        )}

        <DialogFooter className="sm:justify-start mt-4">
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