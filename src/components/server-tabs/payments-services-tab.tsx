"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, CreditCard, PlusCircle, Trash2, Edit, CheckCircle2, AlertCircle, TestTube2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDescriptionComponent, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';

// Plan Schema
const planSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'El nombre es requerido.'),
  price: z.string().min(1, 'El precio es requerido.'),
  price_period: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  features: z.string(),
  cta_text: z.string().optional().nullable(),
  cta_href: z.string().optional().nullable(),
  highlight: z.boolean().optional(),
  badge_text: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  order_index: z.coerce.number().int().optional(),
});

const planSchemaWithTransform = planSchema.extend({
  features: z.string().transform(val => val.split('\n').filter(Boolean)),
});

// PayPal Schema
const paypalConfigSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.'),
  client_id: z.string().min(1, 'El Client ID es requerido.'),
  client_secret: z.string().optional(),
  is_active: z.boolean().optional(),
});

// Types
type PlanFormValues = z.infer<typeof planSchema>;
interface Plan extends z.infer<typeof planSchemaWithTransform> {
  id: string;
  created_at: string;
}
type PayPalConfigFormValues = z.infer<typeof paypalConfigSchema>;
interface PayPalConfig extends PayPalConfigFormValues {
  status: 'unverified' | 'verified' | 'failed';
}

export function PaymentsServicesTab() {
  // Plans State & Logic
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);

  // PayPal State & Logic
  const [paypalConfigs, setPaypalConfigs] = useState<PayPalConfig[]>([]);
  const [isLoadingPayPal, setIsLoadingPayPal] = useState(true);
  const [isSubmittingPayPal, setIsSubmittingPayPal] = useState(false);
  const [editingPayPalConfig, setEditingPayPalConfig] = useState<PayPalConfig | null>(null);
  const [isPayPalDialogOpen, setIsPayPalDialogOpen] = useState(false);
  const [isTestingPayPalId, setIsTestingPayPalId] = useState<string | null>(null);

  // Forms
  const planForm = useForm<PlanFormValues>({ resolver: zodResolver(planSchema), defaultValues: { name: '', price: '', price_period: '', description: '', features: '', cta_text: '', cta_href: '', highlight: false, badge_text: '', is_active: true, order_index: 0 } });
  const paypalForm = useForm<PayPalConfigFormValues>({ resolver: zodResolver(paypalConfigSchema), defaultValues: { nickname: '', client_id: '', client_secret: '', is_active: false } });

  // Fetch Functions
  const fetchPlans = useCallback(async () => { setIsLoadingPlans(true); try { const res = await fetch('/api/admin/pricing-plans'); if (!res.ok) throw new Error((await res.json()).message); setPlans(await res.json()); } catch (e: any) { toast.error(`Error al cargar planes: ${e.message}`); } finally { setIsLoadingPlans(false); } }, []);
  const fetchPayPalConfigs = useCallback(async () => { setIsLoadingPayPal(true); try { const res = await fetch('/api/admin/paypal-configs'); if (!res.ok) throw new Error((await res.json()).message); setPaypalConfigs(await res.json()); } catch (e: any) { toast.error(`Error al cargar configs de PayPal: ${e.message}`); } finally { setIsLoadingPayPal(false); } }, []);

  useEffect(() => { fetchPlans(); fetchPayPalConfigs(); }, [fetchPlans, fetchPayPalConfigs]);

  // Plan Handlers
  const handleEditPlan = (plan: Plan) => { setEditingPlan(plan); planForm.reset({ ...plan, features: Array.isArray(plan.features) ? plan.features.join('\n') : '' }); setIsPlanDialogOpen(true); };
  const handleAddNewPlan = () => { setEditingPlan(null); planForm.reset({ name: '', price: '', price_period: '', description: '', features: '', cta_text: '', cta_href: '', highlight: false, badge_text: '', is_active: true, order_index: (plans.length + 1) * 10 }); setIsPlanDialogOpen(true); };
  const onPlanSubmit = async (values: PlanFormValues) => { setIsSubmittingPlan(true); try { const method = editingPlan ? 'PUT' : 'POST'; const res = await fetch('/api/admin/pricing-plans', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingPlan ? { ...values, id: editingPlan.id } : values) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); setIsPlanDialogOpen(false); fetchPlans(); } catch (e: any) { toast.error(`Error al guardar: ${e.message}`); } finally { setIsSubmittingPlan(false); } };
  const handleDeletePlan = async (id: string) => { try { const res = await fetch(`/api/admin/pricing-plans?id=${id}`, { method: 'DELETE' }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); fetchPlans(); } catch (e: any) { toast.error(`Error al eliminar: ${e.message}`); } };

  // PayPal Handlers
  const handleEditPayPal = (config: PayPalConfig) => { setEditingPayPalConfig(config); paypalForm.reset({ ...config, client_secret: '' }); setIsPayPalDialogOpen(true); };
  const handleAddNewPayPal = () => { setEditingPayPalConfig(null); paypalForm.reset({ nickname: '', client_id: '', client_secret: '', is_active: false }); setIsPayPalDialogOpen(true); };
  const onPayPalSubmit = async (values: PayPalConfigFormValues) => { if (editingPayPalConfig && !values.client_secret) { delete values.client_secret; } else if (!editingPayPalConfig && !values.client_secret) { paypalForm.setError('client_secret', { message: 'El Client Secret es requerido.' }); return; } setIsSubmittingPayPal(true); try { const method = editingPayPalConfig ? 'PUT' : 'POST'; const res = await fetch('/api/admin/paypal-configs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingPayPalConfig ? { ...values, id: editingPayPalConfig.id } : values) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); setIsPayPalDialogOpen(false); fetchPayPalConfigs(); } catch (e: any) { toast.error(`Error al guardar: ${e.message}`); } finally { setIsSubmittingPayPal(false); } };
  const handleDeletePayPal = async (id: string) => { try { const res = await fetch(`/api/admin/paypal-configs?id=${id}`, { method: 'DELETE' }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); fetchPayPalConfigs(); } catch (e: any) { toast.error(`Error al eliminar: ${e.message}`); } };
  const handleTestPayPal = async (id: string) => { setIsTestingPayPalId(id); const toastId = toast.loading('Probando conexión con PayPal...'); try { const res = await fetch('/api/admin/paypal-configs/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message, { id: toastId }); fetchPayPalConfigs(); } catch (e: any) { toast.error(e.message, { id: toastId, duration: 10000 }); } finally { setIsTestingPayPalId(null); } };
  const handleSetPayPalActive = async (id: string) => { setIsSubmittingPayPal(true); try { const res = await fetch('/api/admin/paypal-configs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: true }) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(`Configuración de PayPal activada.`); fetchPayPalConfigs(); } catch (e: any) { toast.error(`Error al activar: ${e.message}`); } finally { setIsSubmittingPayPal(false); } };

  return (
    <div className="space-y-8 p-1">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-6 w-6" /> Planes de Precios</CardTitle>
            <CardDescription>Gestiona los planes de suscripción que se muestran en la landing page.</CardDescription>
          </div>
          <Button size="sm" onClick={handleAddNewPlan}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Plan</Button>
        </CardHeader>
        <CardContent>
          {isLoadingPlans ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Precio</TableHead><TableHead>Activo</TableHead><TableHead>Destacado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{plan.price}{plan.price_period}</TableCell>
                    <TableCell>{plan.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-muted-foreground" />}</TableCell>
                    <TableCell>{plan.highlight ? <Badge>{plan.badge_text || 'Destacado'}</Badge> : null}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEditPlan(plan)}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar este plan?</AlertDialogTitle><AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePlan(plan.id!)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-6 w-6" /> Configuración de PayPal</CardTitle>
            <CardDescription>Gestiona tus credenciales de la API de PayPal.</CardDescription>
          </div>
          <Button size="sm" onClick={handleAddNewPayPal}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Configuración</Button>
        </CardHeader>
        <CardContent>
          {isLoadingPayPal ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Apodo</TableHead><TableHead>Estado</TableHead><TableHead>Activo</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {paypalConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.nickname}</TableCell>
                    <TableCell>{config.status === 'verified' && <Badge><CheckCircle2 className="h-3 w-3 mr-1" /> Verificado</Badge>}{config.status === 'unverified' && <Badge variant="secondary">Sin verificar</Badge>}{config.status === 'failed' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Falló</Badge>}</TableCell>
                    <TableCell>{config.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : null}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleTestPayPal(config.id!)} disabled={!!isTestingPayPalId}>{isTestingPayPalId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}</Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditPayPal(config)}><Edit className="h-4 w-4" /></Button>
                      {!config.is_active && <Button variant="outline" size="sm" onClick={() => handleSetPayPalActive(config.id!)} disabled={isSubmittingPayPal}>Activar</Button>}
                      <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar esta configuración?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePayPal(config.id!)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Plan Dialog */}
      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPlan ? 'Editar Plan' : 'Añadir Nuevo Plan'}</DialogTitle></DialogHeader>
          <Form {...planForm}><form onSubmit={planForm.handleSubmit(onPlanSubmit)} className="space-y-4 py-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={planForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={planForm.control} name="price" render={({ field }) => (<FormItem><FormLabel>Precio</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={planForm.control} name="price_period" render={({ field }) => (<FormItem><FormLabel>Periodo (ej. /mes)</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={planForm.control} name="order_index" render={({ field }) => (<FormItem><FormLabel>Orden</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /></div><FormField control={planForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={planForm.control} name="features" render={({ field }) => (<FormItem><FormLabel>Características (una por línea)</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem>)} /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={planForm.control} name="cta_text" render={({ field }) => (<FormItem><FormLabel>Texto del Botón (CTA)</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={planForm.control} name="cta_href" render={({ field }) => (<FormItem><FormLabel>Enlace del Botón (CTA)</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={planForm.control} name="badge_text" render={({ field }) => (<FormItem><FormLabel>Texto de la Insignia</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={planForm.control} name="highlight" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-6"><FormLabel>Destacar Plan</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} /></div><FormField control={planForm.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Activo</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingPlan}>Cancelar</Button></DialogClose><Button type="submit" disabled={isSubmittingPlan}>{isSubmittingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar</Button></DialogFooter></form></Form>
        </DialogContent>
      </Dialog>

      {/* PayPal Dialog */}
      <Dialog open={isPayPalDialogOpen} onOpenChange={setIsPayPalDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPayPalConfig ? 'Editar' : 'Añadir'} Configuración de PayPal</DialogTitle></DialogHeader>
          <Form {...paypalForm}><form onSubmit={paypalForm.handleSubmit(onPayPalSubmit)} className="space-y-4 py-4"><FormField control={paypalForm.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo</FormLabel><FormControl><Input placeholder="Cuenta Principal" {...field} disabled={isSubmittingPayPal} /></FormControl></FormItem>)} /><FormField control={paypalForm.control} name="client_id" render={({ field }) => (<FormItem><FormLabel>Client ID</FormLabel><FormControl><Input {...field} disabled={isSubmittingPayPal} /></FormControl></FormItem>)} /><FormField control={paypalForm.control} name="client_secret" render={({ field }) => (<FormItem><FormLabel>Client Secret</FormLabel><FormControl><Input type="password" placeholder={editingPayPalConfig ? "Dejar en blanco para no cambiar" : "••••••••"} {...field} disabled={isSubmittingPayPal} /></FormControl></FormItem>)} /><FormField control={paypalForm.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Activar</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmittingPayPal} /></FormControl></FormItem>)} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingPayPal}>Cancelar</Button></DialogClose><Button type="submit" disabled={isSubmittingPayPal}>{isSubmittingPayPal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar</Button></DialogFooter></form></Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}