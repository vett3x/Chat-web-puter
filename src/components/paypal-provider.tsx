"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Loader2 } from 'lucide-react';

interface PayPalConfigContextType {
  isPayPalConfigured: boolean;
}

const PayPalConfigContext = createContext<PayPalConfigContextType>({ isPayPalConfigured: false });

export const usePayPalConfig = () => useContext(PayPalConfigContext);

export function PayPalProvider({ children }: { children: React.ReactNode }) {
  const [initialOptions, setInitialOptions] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayPalConfigured, setIsPayPalConfigured] = useState(false);

  useEffect(() => {
    const fetchPayPalConfig = async () => {
      try {
        const [clientIdRes, clientTokenRes] = await Promise.all([
          fetch('/api/paypal/client-id'),
          fetch('/api/paypal/client-token')
        ]);

        if (!clientIdRes.ok) {
          throw new Error('No se pudo cargar la configuración de PayPal (Client ID).');
        }
        const clientIdData = await clientIdRes.json();
        const clientId = clientIdData.clientId;

        if (!clientTokenRes.ok) {
          const errorData = await clientTokenRes.json();
          throw new Error(errorData.message || 'No se pudo generar el token de autorización de PayPal para pagos con tarjeta.');
        }
        const clientTokenData = await clientTokenRes.json();
        const clientToken = clientTokenData.clientToken;

        if (clientId && clientToken) {
          const options: any = {
            clientId: clientId,
            currency: 'USD',
            intent: 'capture',
            'data-client-token': clientToken,
            components: 'buttons,hosted-fields',
          };
          setInitialOptions(options);
          setIsPayPalConfigured(true);
        } else {
          throw new Error('Faltan el Client ID o el Client Token de PayPal.');
        }
      } catch (error: any) {
        console.error("Error al obtener la configuración de PayPal:", error.message);
        setIsPayPalConfigured(false);
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

  if (!isPayPalConfigured || !initialOptions) {
    return (
      <PayPalConfigContext.Provider value={{ isPayPalConfigured: false }}>
        {children}
      </PayPalConfigContext.Provider>
    );
  }

  return (
    <PayPalConfigContext.Provider value={{ isPayPalConfigured: true }}>
      <PayPalScriptProvider options={initialOptions}>
        {children}
      </PayPalScriptProvider>
    </PayPalConfigContext.Provider>
  );
}