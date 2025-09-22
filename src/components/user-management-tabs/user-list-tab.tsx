"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSession, SUPERUSER_EMAILS } from '@/components/session-context-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
import { ScrollArea } from '@/components/ui/scroll-area';

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export function UserListTab() {
  const { session, isLoading: isSessionLoading } = useSession();
  const currentUserId = session?.user?.id;
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setError(null);
    try {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: User[] = await response.json();
      setUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Error al cargar la lista de usuarios.');
      toast.error(err.message || 'Error al cargar la lista de usuarios.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!isSessionLoading && session) {
      fetchUsers();
    }
  }, [isSessionLoading, session, fetchUsers]);

  const getInitials = (firstName: string | null | undefined, lastName: string | null | undefined, email: string) => {
    const first = firstName ? firstName.charAt(0) : '';
    const last = lastName ? lastName.charAt(0) : '';
    return (first + last).toUpperCase() || email.charAt(0).toUpperCase();
  };

  const handleDeleteUser = async (userId: string) => {
    setIsDeleting(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Usuario eliminado correctamente.');
      fetchUsers();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      toast.error(err.message || 'Error al eliminar el usuario.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Lista de Usuarios
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchUsers} disabled={isLoadingUsers} title="Refrescar">
          {isLoadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoadingUsers && users.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando usuarios...</p>
          </div>
        ) : error && users.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No hay usuarios registrados aún.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  const isSuperUser = SUPERUSER_EMAILS.includes(user.email);

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {user.avatar_url ? (
                            <AvatarImage src={user.avatar_url} alt="Avatar" />
                          ) : (
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {getInitials(user.first_name, user.last_name, user.email)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.first_name || 'N/A'} {user.last_name || ''}</p>
                        </div>
                      </TableCell><TableCell>{user.email}</TableCell><TableCell>
                        {isSuperUser ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Super Admin
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            Usuario
                          </span>
                        )}
                      </TableCell><TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isCurrentUser || isDeleting === user.id}
                              title={isCurrentUser ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                            >
                              {isDeleting === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás seguro de eliminar este usuario?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará permanentemente al usuario "{user.first_name || user.email}" y todos sus datos asociados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}