"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export function PaymentsServicesTab() {
  return (
    <div className="space-y-8 p-1">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Pagos y Servicios
          </CardTitle>
          <CardDescription>
            Gestiona los planes de suscripción, precios, métodos de pago y la seguridad de las transacciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta sección está en desarrollo. Aquí podrás integrar pasarelas de pago como Stripe, definir tus planes y precios, y monitorear las suscripciones de los usuarios.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}