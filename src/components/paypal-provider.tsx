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
          console.warn('No se pudo cargar el Client ID de PayPal. Los pagos de PayPal estarán deshabilitados.');
          setIsPayPalConfigured(false);
          return;
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
          if (clientToken) {
            options['data-client-token'] = clientToken;
          }
          setInitialOptions(options);
          setIsPayPalConfigured(true);
        }
      } catch (error) {
        console.error("Error al obtener la configuración de PayPal:", error);
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