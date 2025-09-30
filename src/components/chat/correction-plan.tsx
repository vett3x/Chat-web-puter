"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, BrainCircuit, Wrench, Check, ThumbsUp, ThumbsDown, Loader2, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn, parseAiResponseToRenderableParts, RenderablePart } from '@/lib/utils'; // Import parseAiResponseToRenderableParts and RenderablePart
import { Message } from '@/hooks/use-general-chat'; // Import Message type

interface CorrectionPlanProps {
  message: Message; // NEW: Pass the full message object
  content: string;
  onApprove: () => void;
  onRequestManualFix: () => void;
  isApproved: boolean;
  isNew?: boolean;
  onAnimationComplete?: () => void;
  isLoading: boolean;
}

interface PlanSection {
  title: string;
  content: string;
  icon: React.ReactNode;
}

export function CorrectionPlan({ message, content, onApprove, onRequestManualFix, isApproved, isNew, onAnimationComplete, isLoading }: CorrectionPlanProps) {
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
        // NEW: Special handling for "Plan de Corrección" section to hide bash:exec
        let finalSectionContent = sectionContent;
        if (mapping.title === "Plan de Corrección") {
          const commands = extractBashExecCommands(sectionContent);
          if (commands.length > 0) {
            finalSectionContent = `Se ejecutarán los siguientes comandos de terminal:\n\n${commands.map((cmd, i) => `${i + 1}. \`${cmd.split('\n')[0].substring(0, 50)}...\``).join('\n')}\n\n(Los comandos exactos se ejecutarán automáticamente al aprobar el plan.)`;
          } else {
            // If no commands, just show the original content (which might be code files or text)
            // For correction plans, AI might generate code files directly in this section.
            // We need to ensure that if it's a code file, it's still rendered as a code block.
            // This means we should NOT replace the content if it's not a bash:exec.
            // The current `parseAiResponseToRenderableParts` in `message-content` will handle code blocks.
            // So, here we only hide bash:exec.
            const codeFileParts = parseAiResponseToRenderableParts(sectionContent, true).filter((p: RenderablePart) => p.type === 'code' && p.language !== 'bash');
            if (codeFileParts.length > 0) {
              finalSectionContent = sectionContent; // Keep original content if it contains code files
            } else {
              finalSectionContent = sectionContent.replace(/```bash:exec[\s\S]*?```/g, "Se ejecutarán comandos de terminal.");
            }
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
      setAnimatedSectionsCount(0);
    } else {
      setAnimatedSectionsCount(parsedSections.length);
    }
  }, [content, isNew]);

  useEffect(() => {
    if (!isNew || animatedSectionsCount >= sections.length) {
      if (isNew && animatedSectionsCount >= sections.length) {
        onAnimationComplete?.();
      }
      return;
    }

    const timer = setTimeout(() => {
      setAnimatedSectionsCount(prev => prev + 1);
    }, 500);

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