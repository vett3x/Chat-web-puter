"use client";

import React, { useState } from 'react';
import {
  PayPalHostedFieldsProvider,
  PayPalHostedField,
  usePayPalHostedFields,
} from "@paypal/react-paypal-js";
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Este componente renderiza los campos del formulario y el botón de envío.
// Debe ser un hijo de PayPalHostedFieldsProvider.
const HostedFields = ({ plan, onPaymentSuccess }: { plan: any, onPaymentSuccess?: () => void }) => {
  const { cardFields } = usePayPalHostedFields();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardHolderName, setCardHolderName] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cardFields) return;

    setIsProcessing(true);
    try {
      const state = await cardFields.getState();
      const isFormValid = Object.values(state.fields).every(field => field.isValid);
      if (!isFormValid) {
        toast.error('Por favor, revisa los datos de tu tarjeta.');
        setIsProcessing(false);
        return;
      }

      const order = await cardFields.submit({
        cardholderName: cardHolderName,
      });
      
      const response = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: order.orderId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      
      toast.success(`¡Gracias por suscribirte al plan ${plan.name}!`);
      onPaymentSuccess?.();
    } catch (error: any) {
      toast.error(`Error al procesar el pago: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="card-number">Número de tarjeta</Label>
        <div id="card-number" className="p-3 border rounded-md bg-background h-[40px]" />
      </div>
      
      <div className="flex gap-4">
        <div className="w-1/2 space-y-1">
          <Label htmlFor="expiration-date">Vencimiento</Label>
          <div id="expiration-date" className="p-3 border rounded-md bg-background h-[40px]" />
        </div>
        <div className="w-1/2 space-y-1">
          <Label htmlFor="cvv">CSC</Label>
          <div id="cvv" className="p-3 border rounded-md bg-background h-[40px]" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="card-holder">Nombre del titular</Label>
        <Input
          id="card-holder"
          type="text"
          value={cardHolderName}
          onChange={(e) => setCardHolderName(e.target.value)}
          className="w-full p-3 border rounded-md bg-background h-[40px]"
          placeholder="Nombre completo"
          disabled={isProcessing}
        />
      </div>

      <Button type="submit" disabled={isProcessing} className="w-full bg-primary-light-purple hover:bg-primary-light-purple/90 text-white h-12 text-base">
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Pagar {plan.price}{plan.price_period}
      </Button>
    </form>
  );
};

// Este es el componente principal que proporciona el contexto.
export function PayPalPaymentForm({ plan, onPaymentSuccess }: { plan: any, onPaymentSuccess?: () => void }) {
  const createOrder = async (): Promise<string> => {
    try {
      const priceValue = plan.price.replace(/[^0-9.]/g, '');
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: priceValue }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data.id;
    } catch (error: any) {
      toast.error(`Error al crear la orden: ${error.message}`);
      throw error;
    }
  };

  return (
    <PayPalHostedFieldsProvider
      createOrder={createOrder}
      styles={{
        '.valid': { color: 'hsl(var(--foreground))' },
        '.invalid': { color: 'hsl(var(--destructive))' },
      }}
    >
      <HostedFields plan={plan} onPaymentSuccess={onPaymentSuccess} />
    </PayPalHostedFieldsProvider>
  );
}