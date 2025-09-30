"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Puzzle, Package, Check, Wand2, ThumbsUp, ThumbsDown, Loader2, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Message } from '@/hooks/use-general-chat'; // Import Message type

interface ConstructionPlanProps {
  message: Message; // NEW: Pass the full message object
  content: string;
  onApprove: () => void;
  onRequestChanges: () => void;
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

export function ConstructionPlan({ message, content, onApprove, onRequestChanges, isApproved, isNew, onAnimationComplete, isLoading }: ConstructionPlanProps) {
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [animatedSectionsCount, setAnimatedSectionsCount] = useState(0);

  const sectionMappings = [
    { title: "Análisis del Requerimiento", icon: <Wand2 className="h-5 w-5 text-purple-400" /> },
    { title: "Estructura de Archivos y Componentes", icon: <FileText className="h-5 w-5 text-blue-400" /> },
    { title: "Lógica de Componentes", icon: <Puzzle className="h-5 w-5 text-orange-400" /> },
    { title: "Dependencias Necesarias", icon: <Package className="h-5 w-5 text-green-400" /> },
    { title: "Acciones de Terminal Necesarias", icon: <Terminal className="h-5 w-5 text-gray-400" /> }, // NEW: Icon for terminal actions
    { title: "Resumen y Confirmación", icon: <Check className="h-5 w-5 text-teal-400" /> },
  ];

  useEffect(() => {
    const rawSections = content.split(/###\s*\d+\.\s*/).slice(1);
    const parsedSections: PlanSection[] = [];

    rawSections.forEach((rawSection) => {
      const lines = rawSection.split('\n');
      const title = lines[0].trim();
      const sectionContent = lines.slice(1).join('\n').trim();
      const mapping = sectionMappings.find(m => title.toLowerCase().includes(m.title.toLowerCase()));
      
      if (mapping) {
        // NEW: Special handling for "Acciones de Terminal Necesarias"
        let finalSectionContent = sectionContent;
        if (mapping.title === "Acciones de Terminal Necesarias") {
          const commands = extractBashExecCommands(sectionContent);
          if (commands.length > 0) {
            finalSectionContent = `Se ejecutarán los siguientes comandos de terminal:\n\n${commands.map((cmd, i) => `${i + 1}. \`${cmd.split('\n')[0].substring(0, 50)}...\``).join('\n')}\n\n(Los comandos exactos se ejecutarán automáticamente al aprobar el plan.)`;
          } else {
            finalSectionContent = "No se requieren comandos de terminal adicionales.";
          }
        }

        parsedSections.push({
          title: mapping.title,
          content: finalSectionContent,
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

  // Helper to extract bash:exec commands from the raw markdown content
  const extractBashExecCommands = (markdown: string): string[] => {
    const commands: string[] = [];
    const regex = /```bash:exec\n([\s\S]*?)\n```/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      commands.push(match[1].trim());
    }
    return commands;
  };

  return (
    <div className="space-y-4 max-w-full">
      <h3 className="text-lg font-semibold text-foreground">Plan de Construcción</h3>
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
            <Check className="h-4 w-4" /> Plan aprobado. Construyendo...
          </p>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onRequestChanges} disabled={isLoading || (isNew && animatedSectionsCount < sections.length)}>
              <ThumbsDown className="h-4 w-4 mr-2" />
              Solicitar Cambios
            </Button>
            <Button size="sm" onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white" disabled={isLoading || (isNew && animatedSectionsCount < sections.length)}>
              <ThumbsUp className="h-4 w-4 mr-2" />
              Aprobar y Construir
            </Button>
          </>
        )}
      </div>
    </div>
  );
}