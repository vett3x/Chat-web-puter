"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Puzzle, Package, Check, Wand2, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ConstructionPlanProps {
  content: string;
  onApprove: () => void;
  onRequestChanges: () => void;
  isApproved: boolean;
}

interface PlanSection {
  title: string;
  content: string;
  icon: React.ReactNode;
}

export function ConstructionPlan({ content, onApprove, onRequestChanges, isApproved }: ConstructionPlanProps) {
  const sections: PlanSection[] = [];
  const rawSections = content.split(/###\s*\d+\.\s*/).slice(1);

  const sectionMappings = [
    { title: "Análisis del Requerimiento", icon: <Wand2 className="h-5 w-5 text-purple-400" /> },
    { title: "Estructura de Archivos y Componentes", icon: <FileText className="h-5 w-5 text-blue-400" /> },
    { title: "Lógica de Componentes", icon: <Puzzle className="h-5 w-5 text-orange-400" /> },
    { title: "Dependencias Necesarias", icon: <Package className="h-5 w-5 text-green-400" /> },
    { title: "Resumen y Confirmación", icon: <Check className="h-5 w-5 text-teal-400" /> },
  ];

  rawSections.forEach((rawSection, index) => {
    const lines = rawSection.split('\n');
    const title = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();
    const mapping = sectionMappings.find(m => title.toLowerCase().includes(m.title.toLowerCase()));
    
    if (mapping) {
      sections.push({
        title: mapping.title,
        content: content,
        icon: mapping.icon,
      });
    }
  });

  return (
    <div className="space-y-4 max-w-full">
      <h3 className="text-lg font-semibold text-foreground">Plan de Construcción</h3>
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
            <Check className="h-4 w-4" /> Plan aprobado. Construyendo...
          </p>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onRequestChanges}>
              <ThumbsDown className="h-4 w-4 mr-2" />
              Solicitar Cambios
            </Button>
            <Button size="sm" onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white">
              <ThumbsUp className="h-4 w-4 mr-2" />
              Aprobar y Construir
            </Button>
          </>
        )}
      </div>
    </div>
  );
}