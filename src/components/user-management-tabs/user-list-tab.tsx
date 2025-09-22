"use client";

import React, { useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Trash2, RefreshCw, AlertCircle, Eye, Search } from 'lucide-react';
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
import { UserDetailDialog } from './user-detail-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator'; // Import Separator

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'super_admin'; // Added role
}

// Define the interface for the ref handle and export it
export interface UserListTabRef {
  fetchUsers: () => void;
}

export const UserListTab = React.forwardRef<UserListTabRef, {}>(({}, ref) => {
  const { session, isLoading: isSessionLoading, userRole: currentUserRole } = useSession(); // Get current user's role
  const currentUserId = session?.user?.id;
  const [allUsers, setAllUsers] = useState<User[]>([]); // Store all fetched users
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]); // Users displayed after filter/search
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'super_admin'>('all');

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
      setAllUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Error al cargar la lista de usuarios.');
      toast.error(err.message || 'Error al cargar la lista de usuarios.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    fetchUsers,
  }));

  useEffect(() => {
    if (!isSessionLoading && session) {
      fetchUsers();
    }
  }, [isSessionLoading, session, fetchUsers]);

  // Effect to apply filters and search whenever allUsers, searchTerm, or roleFilter changes
  useEffect(() => {
    let tempUsers = allUsers;

    // Apply role filter
    if (roleFilter !== 'all') {
      tempUsers = tempUsers.filter(user => user.role === roleFilter);
    }

    // Apply search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      tempUsers = tempUsers.filter(user =>
        user.email.toLowerCase().includes(lowerCaseSearchTerm) ||
        (user.first_name && user.first_name.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (user.last_name && user.last_name.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    setFilteredUsers(tempUsers);
  }, [allUsers, searchTerm, roleFilter]);

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

  const handleOpenUserDetails = (user: User) => {
    setSelectedUser(user);
    setIsDetailDialogOpen(true);
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }

  const isCurrentUserSuperAdmin = currentUserRole === 'super_admin';

  const renderUserTable = (usersToRender: User[], title: string) => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" /> {title} ({usersToRender.length})
      </h3>
      {usersToRender.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay usuarios en esta categoría.</p>
      ) : (
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
            {usersToRender.map((user) => {
              const isCurrentUser = user.id === currentUserId;
              const isTargetUserSuperAdmin = user.role === 'super_admin';

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
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.role === 'super_admin' ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Super Admin
                      </span>
                    ) : user.role === 'admin' ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        Usuario
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenUserDetails(user)}
                        title="Ver detalles del usuario"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isCurrentUser || isTargetUserSuperAdmin || isDeleting === user.id || !isCurrentUserSuperAdmin} // Only Super Admin can delete, and not themselves or other Super Admins
                            title={isCurrentUser ? "No puedes eliminar tu propia cuenta" : (isTargetUserSuperAdmin ? "No puedes eliminar a otro Super Admin" : (isCurrentUserSuperAdmin ? "Eliminar usuario" : "No tienes permiso para eliminar usuarios"))}
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
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );

  const superAdmins = filteredUsers.filter(user => user.role === 'super_admin');
  const admins = filteredUsers.filter(user => user.role === 'admin');
  const normalUsers = filteredUsers.filter(user => user.role === 'user');

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
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuario por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={(value: typeof roleFilter) => setRoleFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoadingUsers && filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando usuarios...</p>
          </div>
        ) : error && filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No se encontraron usuarios que coincidan con los criterios.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full p-1">
            <div className="space-y-8">
              {renderUserTable(superAdmins, 'Super Admins')}
              <Separator />
              {renderUserTable(admins, 'Admins')}
              <Separator />
              {renderUserTable(normalUsers, 'Usuarios')}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      {selectedUser && (
        <UserDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          user={selectedUser}
          currentUserRole={currentUserRole} // Pass current user's role
        />
      )}
    </Card>
  );
});

UserListTab.displayName = 'UserListTab';