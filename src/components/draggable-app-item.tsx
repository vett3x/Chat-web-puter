"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Code, MoreVertical, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserApp {
  id: string;
  name: string;
  status: string;
}

interface DraggableAppItemProps {
  app: UserApp;
  selected: boolean;
  onSelect: () => void;
  onDelete: (appId: string) => void;
  isDeleting: boolean;
}

export function DraggableAppItem({ app, selected, onSelect, onDelete, isDeleting }: DraggableAppItemProps) {
  if (isDeleting) {
    return (
      <Card className="bg-destructive/10 transition-colors">
        <CardContent className="py-1 px-1.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-2 flex-1 overflow-hidden text-destructive">
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            <span className="text-xs truncate">Eliminando "{app.name}"...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-sidebar-accent transition-colors group relative",
        selected && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
      )}
      onClick={onSelect}
    >
      <CardContent className="py-1 px-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 flex-1 overflow-hidden">
          {app.status === 'provisioning' ? (
            <Loader2 className="h-3 w-3 ml-2 animate-spin" />
          ) : (
            <Code className="h-3 w-3 ml-2" />
          )}
          <span className="text-xs truncate">{app.name}</span>
        </div>
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover text-popover-foreground border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar Proyecto
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de eliminar este proyecto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción es irreversible. Se eliminará el contenedor Docker, el túnel de Cloudflare y todos los archivos asociados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(app.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}