"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, PlusCircle, Trash2, Edit, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from 'next/image';

const logoSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  logo_file: z.any().refine(files => files?.length > 0, 'El archivo del logo es requerido.'),
  order_index: z.coerce.number().int().optional(),
});

type LogoFormValues = z.infer<typeof logoSchema>;
interface TechnologyLogo {
  id: string;
  name: string;
  logo_url: string;
  order_index: number;
}

export function TechnologyLogosManager() {
  const [logos, setLogos] = useState<TechnologyLogo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<LogoFormValues>({
    resolver: zodResolver(logoSchema),
    defaultValues: { name: '', logo_file: undefined, order_index: 0 },
  });

  const fetchLogos = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/technology-logos');
      if (!response.ok) throw new Error((await response.json()).message);
      setLogos(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar logos: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);

  const onSubmit = async (values: LogoFormValues) => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('logo_file', values.logo_file[0]);
    formData.append('order_index', String(values.order_index || 0));

    try {
      const response = await fetch('/api/admin/technology-logos', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      setIsDialogOpen(false);
      form.reset();
      fetchLogos();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/technology-logos?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchLogos();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => form.reset({ name: '', logo_file: undefined, order_index: (logos.length + 1) * 10 })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Logo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Añadir Nuevo Logo de Tecnología</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="logo_file" render={({ field: { onChange, value, ...rest } }) => (<FormItem><FormLabel>Archivo del Logo (PNG, JPG, SVG)</FormLabel><FormControl><Input type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={e => onChange(e.target.files)} {...rest} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="order_index" render={({ field }) => (<FormItem><FormLabel>Orden</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <Table>
          <TableHeader><TableRow><TableHead>Logo</TableHead><TableHead>Nombre</TableHead><TableHead>Orden</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
          <TableBody>
            {logos.map((logo) => (
              <TableRow key={logo.id}>
                <TableCell><Image src={logo.logo_url} alt={logo.name} width={40} height={40} className="h-10 w-10 object-contain" /></TableCell>
                <TableCell className="font-medium">{logo.name}</TableCell>
                <TableCell>{logo.order_index}</TableCell>
                <TableCell className="text-right">
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar este logo?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(logo.id)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}