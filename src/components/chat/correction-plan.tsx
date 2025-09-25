"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, BrainCircuit, Wrench, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CorrectionPlanProps {
  content: string;
  onApprove: () => void;
  onRequestManualFix: () => void;
  isApproved: boolean;
}

interface PlanSection {
  title: string;
  content: string;
  icon: React.ReactNode;
}

export function CorrectionPlan({ content, onApprove, onRequestManualFix, isApproved }: CorrectionPlanProps) {
  const sections: PlanSection[] = [];
  const rawSections = content.split(/###\s*💡?\s*/).slice(1);

  const sectionMappings = [
    { title: "Error Detectado", icon: <AlertTriangle className="h-5 w-5 text-red-400" /> },
    { title: "Análisis de la IA", icon: <BrainCircuit className="h-5 w-5 text-blue-400" /> },
    { title: "Plan de Corrección", icon: <Wrench className="h-5 w-5 text-orange-400" /> },
    { title: "Confirmación", icon: <Check className="h-5 w-5 text-teal-400" /> },
  ];

  rawSections.forEach((rawSection) => {
    const lines = rawSection.split('\n');
    const title = lines[0].trim();
    const sectionContent = lines.slice(1).join('\n').trim();
    const mapping = sectionMappings.find(m => title.toLowerCase().includes(m.title.toLowerCase()));
    
    if (mapping) {
      sections.push({
        title: mapping.title,
        content: sectionContent,
        icon: mapping.icon,
      });
    }
  });

  return (
    <div className="space-y-4 max-w-full">
      <h3 className="text-lg font-semibold text-foreground">Informe de Error y Plan de Corrección</h3>
      {sections.map((section, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            {section.icon}
            <h4>{section.title}</h4>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none pl-7 text-muted-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/20">
        {isApproved ? (
          <p className="text-sm text-green-500 font-medium flex items-center gap-2">
            <Check className="h-4 w-4" /> Aprobado. Intentando arreglo...
          </p>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onRequestManualFix}>
              <ThumbsDown className="h-4 w-4 mr-2" />
              Lo Arreglaré Manualmente
            </Button>
            <Button size="sm" onClick={onApprove} className="bg-blue-600 hover:bg-blue-700 text-white">
              <ThumbsUp className="h-4 w-4 mr-2" />
              Intentar Arreglo Automático
            </Button>
          </>
        )}
      </div>
    </div>
  );
}