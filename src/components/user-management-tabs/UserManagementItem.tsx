"use client";

import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserManagementItemProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

export const UserManagementItem: React.FC<UserManagementItemProps> = ({ id, icon, label, description, children, isOpen, onToggle }) => (
  <Collapsible open={isOpen} onOpenChange={onToggle} className="border rounded-lg bg-black/20 border-white/10">
    <CollapsibleTrigger asChild>
      <button type="button" className="flex items-center justify-between w-full p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">{icon}</div>
          <div>
            <h4 className="font-semibold">{label}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div >
        {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
      <div className="border-t border-white/10 px-4 pt-4 pb-4">
        {children}
      </div>
    </CollapsibleContent>
  </Collapsible>
);