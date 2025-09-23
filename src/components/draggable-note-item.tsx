"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Note {
  id: string;
  title: string;
}

interface DraggableNoteItemProps {
  note: Note;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  level: number;
}

export function DraggableNoteItem({ note, selected, onSelect, onDragStart, level }: DraggableNoteItemProps) {
  const paddingLeft = `${level * 1.25 + 0.5}rem`;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-sidebar-accent transition-colors group relative",
        selected && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
      )}
      onClick={onSelect}
      draggable="true"
      onDragStart={onDragStart}
      style={{ paddingLeft }}
    >
      <CardContent className="py-1 px-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 flex-1 overflow-hidden">
          <FileText className="h-3 w-3 flex-shrink-0" />
          <span className="text-xs truncate">{note.title}</span>
        </div>
      </CardContent>
    </Card>
  );
}