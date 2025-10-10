"use client";

import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Loader2 } from 'lucide-react';

export function PayPalProvider({ children }: { children: React.ReactNode }) {
  const [initialOptions, setInitialOptions] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPayPalConfig = async () => {
      try {
        // Fetch both client ID and client token in parallel
        const [clientIdRes, clientTokenRes] = await Promise.all([
          fetch('/api/paypal/client-id'),
          fetch('/api/paypal/client-token')
        ]);

        if (!clientIdRes.ok) {
          // If client ID fails, we can't do anything with PayPal
          throw new Error('No se pudo cargar la configuración de PayPal (Client ID).');
        }
        const clientIdData = await clientIdRes.json();
        const clientId = clientIdData.clientId;

        let clientToken = null;
        if (clientTokenRes.ok) {
          const clientTokenData = await clientTokenRes.json();
          clientToken = clientTokenData.clientToken;
        } else {
          console.warn("No se pudo obtener el client token de PayPal. Los pagos con tarjeta pueden no funcionar.");
        }

        if (clientId) {
          const options: any = {
            clientId: clientId,
            currency: 'USD',
            intent: 'capture',
          };
          // Only add the data-client-token if it exists
          if (clientToken) {
            options['data-client-token'] = clientToken;
          }
          setInitialOptions(options);
        }
      } catch (error) {
        console.error("Error al obtener la configuración de PayPal:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayPalConfig();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!initialOptions) {
    // Render children without PayPal if no config is found
    return <>{children}</>;
  }

  return (
    <PayPalScriptProvider options={initialOptions}>
      {children}
    </PayPalScriptProvider>
  );
}