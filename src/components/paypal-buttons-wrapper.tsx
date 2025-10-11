"use client";

import React from 'react';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface PayPalButtonsWrapperProps {
  plan: {
    price: string;
    name: string;
  };
  onPaymentSuccess?: () => void;
  fundingSource?: 'paypal' | 'card' | 'paylater' | 'credit';
}

export function PayPalButtonsWrapper({ plan, onPaymentSuccess, fundingSource }: PayPalButtonsWrapperProps) {
  const [{ isPending }] = usePayPalScriptReducer();

  const createOrder = async (): Promise<string> => {
    try {
      const priceValue = plan.price.replace(/[^0-9.]/g, '');
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: priceValue,
          planName: plan.name 
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data.id;
    } catch (error: any) {
      toast.error(`Error al crear la orden: ${error.message}`);
      throw error;
    }
  };

  const onApprove = async (data: { orderID: string }): Promise<void> => {
    try {
      const response = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: data.orderID }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`¡Gracias por suscribirte al plan ${plan.name}!`);
      onPaymentSuccess?.();
    } catch (error: any) {
      toast.error(`Error al procesar el pago: ${error.message}`);
      throw error;
    }
  };

  const onError = (err: any) => {
    toast.error('Ocurrió un error con el pago de PayPal.');
    console.error('PayPal Error:', err);
  };

  if (isPending) {
    return <div className="flex justify-center items-center h-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <PayPalButtons
      style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay', height: 48 }}
      createOrder={createOrder}
      onApprove={onApprove}
      onError={onError}
      className="w-full"
      fundingSource={fundingSource}
    />
  );
}