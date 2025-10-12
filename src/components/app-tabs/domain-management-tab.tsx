"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, CheckCircle2, XCircle, Globe, Link as LinkIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const domainSearchSchema = z.object({
  domain: z.string().min(3, 'Debe tener al menos 3 caracteres.').regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Formato de dominio inválido.'),
});

type DomainSearchFormValues = z.infer<typeof domainSearchSchema>;

interface SearchResult {
  domain: string;
  available: boolean;
  price?: string;
}

interface DomainManagementTabProps {
  appId: string;
}

export function DomainManagementTab({ appId }: DomainManagementTabProps) {
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  const form = useForm<DomainSearchFormValues>({
    resolver: zodResolver(domainSearchSchema),
    defaultValues: { domain: '' },
  });

  const fetchAppDetails = useCallback(async () => {
    // This is a simplified fetch. In a real app, you might get this from a context or a more robust data fetching hook.
    try {
      // We don't have a direct /api/apps/[id] GET endpoint, so we simulate fetching this info.
      // In a real scenario, you'd fetch the app details and set the activeDomain.
      // For now, we'll leave this empty as the registration flow will update the state.
    } catch (err) {
      // Handle error
    }
  }, [appId]);

  useEffect(() => {
    fetchAppDetails();
  }, [fetchAppDetails]);

  const handleSearch = async (values: DomainSearchFormValues) => {
    setIsLoading(true);
    setSearchResult(null);
    try {
      const response = await fetch('/api/domains/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: values.domain }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setSearchResult(result);
    } catch (err: any) {
      toast.error(`Error al buscar dominio: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!searchResult || !searchResult.available) return;
    setIsRegistering(true);
    try {
      const response = await fetch('/api/domains/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: searchResult.domain, appId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      setActiveDomain(searchResult.domain);
      setSearchResult(null);
    } catch (err: any) {
      toast.error(`Error al registrar el dominio: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="h-full p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Dominio Personalizado</CardTitle>
          <CardDescription>Busca y registra un dominio personalizado para tu aplicación.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeDomain ? (
            <div className="p-4 border rounded-lg bg-green-500/10 text-green-500">
              <h4 className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Dominio Activo</h4>
              <p>Esta aplicación está vinculada al dominio:</p>
              <a href={`https://${activeDomain}`} target="_blank" rel="noopener noreferrer" className="font-bold text-lg hover:underline flex items-center gap-1">
                <LinkIcon className="h-4 w-4" /> {activeDomain}
              </a>
            </div>
          ) : (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSearch)} className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name="domain"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="ej: mi-tienda-increible.com" {...field} disabled={isLoading || isRegistering} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading || isRegistering}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Buscar
                  </Button>
                </form>
              </Form>

              {searchResult && (
                <div className="mt-6 p-4 border rounded-lg flex items-center justify-between animate-in fade-in">
                  {searchResult.available ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <p className="font-semibold">¡El dominio <span className="font-bold">{searchResult.domain}</span> está disponible!</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5" />
                      <p className="font-semibold">El dominio <span className="font-bold">{searchResult.domain}</span> no está disponible.</p>
                    </div>
                  )}
                  {searchResult.available && (
                    <div className="text-right">
                      <p className="font-bold text-lg">{searchResult.price}</p>
                      <Button size="sm" className="mt-1" onClick={handleRegister} disabled={isRegistering}>
                        {isRegistering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Registrar y Configurar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}