"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,

} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,

} from '@/components/ui/select';

const addUserFormSchema = z.object({
  email: z.string().email({ message: 'Correo electrónico inválido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(['user', 'admin']), // Removed .default() from schema to make it non-optional in inferred type
});

// Explicitly define the inferred type from the schema, ensuring 'role' is not optional
type AddUserFormValues = z.infer<typeof addUserFormSchema>;

interface AddUserFormProps {
  onUserAdded: () => void; // Callback to refresh user list
  isUserTemporarilyDisabled: boolean; // Ensure this prop is declared
}

export function AddUserForm({ onUserAdded, isUserTemporarilyDisabled }: AddUserFormProps) {
  const [isAddingUser, setIsAddingUser] = useState(false);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'user', // Explicitly set default role here, matching the non-optional schema type
    },
  });

  const onSubmit = async (values: AddUserFormValues) => {
    setIsAddingUser(true);
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      toast.success(result.message || 'Usuario añadido correctamente.');
      form.reset({ role: 'user' }); // Reset form including role
      onUserAdded(); // Notify parent to refresh user list
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(`Error al añadir el usuario: ${error.message}`);
    } finally {
      setIsAddingUser(false);
    }
  };

  return (
    <Card className="h-full bg-black/20 border-white/10 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-6 w-6" /> Añadir Nuevo Usuario
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input placeholder="usuario@ejemplo.com" {...field} disabled={isAddingUser || isUserTemporarilyDisabled} className="bg-black/20 border-white/10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isAddingUser || isUserTemporarilyDisabled} className="bg-black/20 border-white/10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del usuario" {...field} disabled={isAddingUser || isUserTemporarilyDisabled} className="bg-black/20 border-white/10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apellido (Opcional)</FormLabel> {/* Corrected closing tag */}
                  <FormControl>
                    <Input placeholder="Apellido del usuario" {...field} disabled={isAddingUser || isUserTemporarilyDisabled} className="bg-black/20 border-white/10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isAddingUser || isUserTemporarilyDisabled}>
                    <FormControl>
                      <SelectTrigger className="bg-black/20 border-white/10">
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isAddingUser || isUserTemporarilyDisabled}>
              {isAddingUser ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Añadir Usuario
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}