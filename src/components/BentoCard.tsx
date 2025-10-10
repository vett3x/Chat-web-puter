"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface BentoCardProps {
  className?: string;
  label: string;
  title: string;
  description: string;
}

export const BentoCard: React.FC<BentoCardProps> = ({ className, label, title, description }) => {
  return (
    <div
      className={cn(
        "bg-[#0A021A] border border-white/10 rounded-xl p-6 flex flex-col gap-4",
        className
      )}
    >
      <span className="text-sm text-primary-light-purple">{label}</span>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/60">{description}</p>
      </div>
    </div>
  );
};