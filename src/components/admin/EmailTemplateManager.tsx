"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, PlusCircle, Trash2, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from 'next-themes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1, 'El slug es requerido.').regex(/^[a-z0-9-]+$/, 'Slug inválido (solo minúsculas, números y guiones).'),
  name: z.string().min(1, 'El nombre es requerido.'),
  subject: z.string().min(1, 'El asunto es requerido.'),
  content: z.string().optional(),
});

type TemplateFormValues = z.infer<typeof templateSchema>;
interface EmailTemplate extends TemplateFormValues {
  updated_at: string;
}

export function EmailTemplateManager() {
  const { resolvedTheme } = useTheme();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { slug: '', name: '', subject: '', content: '' },
  });

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/email-templates');
      if (!response.ok) throw new Error((await response.json()).message);
      setTemplates(await response.json());
    } catch (err: any) { toast.error(`Error al cargar plantillas: ${err.message}`); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    form.reset(template);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingTemplate(null);
    form.reset({ slug: '', name: '', subject: '', content: '' });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: TemplateFormValues) => {
    setIsSubmitting(true);
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/email-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate ? { ...values, id: editingTemplate.id } : values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      setIsDialogOpen(false);
      fetchTemplates();
    } catch (err: any) { toast.error(`Error al guardar: ${err.message}`); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (slug: string) => {
    try {
      const response = await fetch(`/api/admin/email-templates?slug=${slug}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchTemplates();
    } catch (err: any) { toast.error(`Error al eliminar: ${err.message}`); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Plantilla</Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <Table>
          <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Slug</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.slug}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell className="font-mono text-xs">{template.slug}</TableCell>
                <TableCell className="text-right space-x-2">
                  <a href={`/api/emails/render?template=${template.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                  </a>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(template)}><Edit className="h-4 w-4" /></Button>
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar esta plantilla?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(template.slug!)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Editar' : 'Añadir'} Plantilla de Email</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="slug" render={({ field }) => (<FormItem><FormLabel>Slug</FormLabel><FormControl><Input {...field} disabled={!!editingTemplate} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Asunto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="content" render={({ field }) => (<FormItem><FormLabel>Contenido (Markdown)</FormLabel><div data-color-mode={resolvedTheme}><MDEditor height={300} value={field.value} onChange={field.onChange} preview="live" /></div><FormMessage /></FormItem>)} />
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar</Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}