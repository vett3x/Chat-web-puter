"use client";

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileText, XCircle } from 'lucide-react';

interface SelectedFile {
  file: File;
  preview?: string;
  type: 'image' | 'other';
}

interface FileAttachmentPreviewProps {
  selectedFiles: SelectedFile[];
  onRemoveFile: (index: number) => void;
}

export function FileAttachmentPreview({ selectedFiles, onRemoveFile }: FileAttachmentPreviewProps) {
  if (selectedFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b border-input">
      {selectedFiles.map((item, index) => (
        <div key={index} className="relative w-24 h-24 rounded-md overflow-hidden border bg-muted">
          {item.type === 'image' && item.preview ? (
            <Image src={item.preview} alt={`Preview ${item.file.name}`} layout="fill" objectFit="cover" className="rounded-md" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-2 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground w-full truncate mt-1" title={item.file.name}>{item.file.name}</p>
            </div>
          )}
          <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 rounded-full bg-background/70 hover:bg-background text-destructive hover:text-destructive-foreground" onClick={() => onRemoveFile(index)}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}