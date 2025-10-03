"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Carga dinámica del TipTapEditor con la opción ssr: false
export const DynamicTipTapEditor = dynamic(
  () => import('./tiptap-editor').then((mod) => mod.TipTapEditor),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    ),
  }
);