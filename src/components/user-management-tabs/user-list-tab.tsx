"use client";

import React, { useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Trash2, RefreshCw, AlertCircle, Eye, Search, Crown, Shield, Bot, LogOut, Ban, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { SUPERUSER_EMAILS } from '@/lib/constants';
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
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReasonDialog } from './reason-dialog'; // Import the new dialog

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'banned';
}

export interface UserListTabRef {
  fetchUsers: () => void;
}

export const UserListTab = React.forwardRef<UserListTabRef, {}>(({}, ref) => {
  const { session, isLoading: isSessionLoading, userRole: currentUserRole } = useSession();
  const currentUserId = session?.user?.id;
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'super_admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [reasonDialogState, setReasonDialogState] = useState<{ isOpen: boolean; user: User | null; action: 'expulsar' | 'banear' | null }>({ isOpen: false, user: null, action: null });

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
      toast.error(err.message || 'Error al cargar la lista de usuarios.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    fetchUsers,
  }), [fetchUsers]);

  useEffect(() => {
    if (!isSessionLoading && session) {
      fetchUsers();
    }
  }, [isSessionLoading, session, fetchUsers]);

  useEffect(() => {
    let tempUsers = allUsers;
    if (roleFilter !== 'all') tempUsers = tempUsers.filter(user => user.role === roleFilter);
    if (statusFilter !== 'all') tempUsers = tempUsers.filter(user => user.status === statusFilter);
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      tempUsers = tempUsers.filter(user =>
        user.email.toLowerCase().includes(lowerCaseSearchTerm) ||
        (user.first_name && user.first_name.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (user.last_name && user.last_name.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }
    setFilteredUsers(tempUsers);
  }, [allUsers, searchTerm, roleFilter, statusFilter]);

  const handleUserStatusChange = async (userId: string, action: 'kick' | 'ban' | 'unban', reason: string) => {
    setIsActionLoading(userId);
    try {
      const response = await fetch(`/api/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchUsers();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsActionLoading(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE', credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleOpenUserDetails = (user: User) => {
    setSelectedUser(user);
    setIsDetailDialogOpen(true);
  };

  const openReasonDialog = (user: User, action: 'expulsar' | 'banear') => {
    setReasonDialogState({ isOpen: true, user, action });
  };

  if (isSessionLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const isCurrentUserSuperAdmin = currentUserRole === 'super_admin';
  const isCurrentUserAdmin = currentUserRole === 'admin';

  const renderUserTable = (usersToRender: User[], title: string) => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        {title.includes('Baneados') ? <Ban className="h-5 w-5 text-muted-foreground" /> : <Users className="h-5 w-5 text-muted-foreground" />}
        {title} ({usersToRender.length})
      </h3>
      {usersToRender.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay usuarios en esta categoría.</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Email</TableHead><TableHead>Rol</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
          <TableBody>
            {usersToRender.map((user) => {
              const isCurrentUser = user.id === currentUserId;
              const canSuperAdminAct = isCurrentUserSuperAdmin && user.role !== 'super_admin' && !isCurrentUser;
              const canAdminAct = isCurrentUserAdmin && user.role === 'user' && !isCurrentUser;
              const canPerformModeration = canSuperAdminAct || canAdminAct;

              return (
                <TableRow key={user.id} className={cn(user.status === 'banned' && 'bg-muted/50 opacity-60')}>
                  <TableCell className="flex items-center gap-2">
                    <Avatar className="h-8 w-8"><AvatarImage src={user.avatar_url || ''} alt="Avatar" /><AvatarFallback className="bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></AvatarFallback></Avatar>
                    <div><p className="font-medium">{user.first_name || 'N/A'} {user.last_name || ''}</p></div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.role !== 'user' && (
                        <Badge className={cn(
                          user.role === 'super_admin' && 'bg-yellow-500 text-yellow-900 dark:bg-yellow-400 dark:text-yellow-950 border-transparent',
                          user.role === 'admin' && 'bg-primary-light-purple text-white border-transparent'
                        )}>
                          {user.role === 'super_admin' ? <Crown className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                          {user.role === 'super_admin' ? 'Super Admin' : user.role}
                        </Badge>
                      )}
                      {user.status === 'banned' && <Badge variant="destructive">Baneado</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isActionLoading === user.id ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenUserDetails(user)}><Eye className="h-4 w-4" /></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" disabled={!canPerformModeration}><Users className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openReasonDialog(user, 'expulsar')}><LogOut className="mr-2 h-4 w-4" /> Expulsar</DropdownMenuItem>
                              {user.status === 'banned' ? (
                                <DropdownMenuItem onClick={() => openReasonDialog(user, 'unban' as any)}><CheckCircle className="mr-2 h-4 w-4" /> Desbanear</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => openReasonDialog(user, 'banear')} className="text-destructive focus:text-destructive"><Ban className="mr-2 h-4 w-4" /> Banear</DropdownMenuItem>
                              )}
                              {isCurrentUserSuperAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem></AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>¿Seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente al usuario "{user.first_name || user.email}".</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
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

  const activeUsers = filteredUsers.filter(u => u.status === 'active');
  const bannedUsers = filteredUsers.filter(u => u.status === 'banned');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Lista de Usuarios</CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchUsers} disabled={isLoadingUsers}><RefreshCw className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
          <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por rol" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Roles</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="user">Usuario</SelectItem></SelectContent></Select>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Estados</SelectItem><SelectItem value="active">Activo</SelectItem><SelectItem value="banned">Baneado</SelectItem></SelectContent></Select>
        </div>
        {isLoadingUsers && filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : error && filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive"><AlertCircle className="h-6 w-6 mr-2" />{error}</div>
        ) : (
          <ScrollArea className="h-full w-full p-1">
            <div className="space-y-8">
              {renderUserTable(activeUsers.filter(u => u.role === 'super_admin'), 'Super Admins')}
              <Separator />
              {renderUserTable(activeUsers.filter(u => u.role === 'admin'), 'Admins')}
              <Separator />
              {renderUserTable(activeUsers.filter(u => u.role === 'user'), 'Usuarios')}
              {bannedUsers.length > 0 && <Separator />}
              {renderUserTable(bannedUsers, 'Usuarios Baneados')}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      {selectedUser && <UserDetailDialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen} user={selectedUser} currentUserRole={currentUserRole} onRoleUpdated={fetchUsers} />}
      {reasonDialogState.isOpen && reasonDialogState.user && (
        <ReasonDialog
          open={reasonDialogState.isOpen}
          onOpenChange={(open) => setReasonDialogState({ ...reasonDialogState, isOpen: open })}
          userName={reasonDialogState.user.first_name || reasonDialogState.user.email}
          action={reasonDialogState.action!}
          onSubmit={(reason) => {
            if (reasonDialogState.user && reasonDialogState.action) {
              handleUserStatusChange(reasonDialogState.user.id, reasonDialogState.action as 'kick' | 'ban', reason);
            }
          }}
        />
      )}
    </Card>
  );
});

UserListTab.displayName = 'UserListTab';