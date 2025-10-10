"use client";

import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Loader2 } from 'lucide-react';

export function PayPalProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClientId = async () => {
      try {
        const response = await fetch('/api/paypal/client-id');
        if (!response.ok) throw new Error('No se pudo cargar la configuración de PayPal.');
        const data = await response.json();
        setClientId(data.clientId);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClientId();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!clientId) {
    // Render children without PayPal if no client ID is found
    return <>{children}</>;
  }

  return (
    <PayPalScriptProvider options={{ clientId: clientId, currency: 'USD', intent: 'capture' }}>
      {children}
    </PayPalScriptProvider>
  );
}