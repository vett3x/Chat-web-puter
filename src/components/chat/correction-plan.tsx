"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, BrainCircuit, Wrench, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface CorrectionPlanProps {
  content: string;
  onApprove: () => void;
  onRequestManualFix: () => void;
  isApproved: boolean;
  isNew?: boolean; // Prop para indicar si el plan es nuevo y debe animarse
  onAnimationComplete?: () => void; // Callback cuando la animación del plan termina
  isLoading: boolean; // NEW: Prop to disable buttons while AI is thinking
}

interface PlanSection {
  title: string;
  content: string;
  icon: React.ReactNode;
}

export function CorrectionPlan({ content, onApprove, onRequestManualFix, isApproved, isNew, onAnimationComplete, isLoading }: CorrectionPlanProps) {
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [animatedSectionsCount, setAnimatedSectionsCount] = useState(0);

  const sectionMappings = [
    { title: "Error Detectado", icon: <AlertTriangle className="h-5 w-5 text-red-400" /> },
    { title: "Análisis de la IA", icon: <BrainCircuit className="h-5 w-5 text-blue-400" /> },
    { title: "Plan de Corrección", icon: <Wrench className="h-5 w-5 text-orange-400" /> },
    { title: "Confirmación", icon: <Check className="h-5 w-5 text-teal-400" /> },
  ];

  useEffect(() => {
    const rawSections = content.split(/###\s*💡?\s*/).slice(1);
    const parsedSections: PlanSection[] = [];

    rawSections.forEach((rawSection) => {
      const lines = rawSection.split('\n');
      const title = lines[0].trim();
      const sectionContent = lines.slice(1).join('\n').trim();
      const mapping = sectionMappings.find(m => title.toLowerCase().includes(m.title.toLowerCase()));
      
      if (mapping) {
        parsedSections.push({
          title: mapping.title,
          content: sectionContent,
          icon: mapping.icon,
        });
      }
    });
    setSections(parsedSections);
    if (isNew) {
      setAnimatedSectionsCount(0); // Reset animation count when new plan arrives
    } else {
      setAnimatedSectionsCount(parsedSections.length); // Show all if not new
    }
  }, [content, isNew]);

  useEffect(() => {
    if (!isNew || animatedSectionsCount >= sections.length) {
      if (isNew && animatedSectionsCount >= sections.length) {
        onAnimationComplete?.(); // Notify parent when all sections are animated
      }
      return;
    }

    const timer = setTimeout(() => {
      setAnimatedSectionsCount(prev => prev + 1);
    }, 500); // Delay between sections

    return () => clearTimeout(timer);
  }, [animatedSectionsCount, sections.length, isNew, onAnimationComplete]);

  return (
    <div className="space-y-4 max-w-full">
      <h3 className="text-lg font-semibold text-foreground">Informe de Error y Plan de Corrección</h3>
      {sections.map((section, index) => (
        <div 
          key={index} 
          className={cn(
            "space-y-2 transition-opacity duration-500",
            isNew && index >= animatedSectionsCount ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="flex items-center gap-2 font-medium text-foreground">
            {section.icon}
            <h4>{section.title}</h4>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none pl-7">
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
            <Button variant="outline" size="sm" onClick={onRequestManualFix} disabled={isLoading || (isNew && animatedSectionsCount < sections.length)}>
              <ThumbsDown className="h-4 w-4 mr-2" />
              Lo Arreglaré Manualmente
            </Button>
            <Button size="sm" onClick={onApprove} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading || (isNew && animatedSectionsCount < sections.length)}>
              <ThumbsUp className="h-4 w-4 mr-2" />
              Intentar Arreglo Automático
            </Button>
          </>
        )}
      </div>
    </div>
  );
}