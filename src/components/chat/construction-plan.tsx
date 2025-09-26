"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Puzzle, Package, Check, Wand2, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils'; // Import cn for conditional styling

interface ConstructionPlanProps {
  content: string;
  onApprove: () => void;
  onRequestChanges: () => void;
  isApproved: boolean;
  isNew?: boolean; // Prop para indicar si el plan es nuevo y debe animarse
  onAnimationComplete?: () => void; // Callback cuando la animación del plan termina
}

interface PlanSection {
  title: string;
  content: string;
  icon: React.ReactNode;
}

export function ConstructionPlan({ content, onApprove, onRequestChanges, isApproved, isNew, onAnimationComplete }: ConstructionPlanProps) {
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [displayedContent, setDisplayedContent] = useState<string[]>([]);
  const [animationFinished, setAnimationFinished] = useState(false); // New state to track overall animation

  const sectionMappings = [
    { title: "Análisis del Requerimiento", icon: <Wand2 className="h-5 w-5 text-purple-400" /> },
    { title: "Estructura de Archivos y Componentes", icon: <FileText className="h-5 w-5 text-blue-400" /> },
    { title: "Lógica de Componentes", icon: <Puzzle className="h-5 w-5 text-orange-400" /> },
    { title: "Dependencias Necesarias", icon: <Package className="h-5 w-5 text-green-400" /> },
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
        parsedSections.push({ title: mapping.title, content: sectionContent, icon: mapping.icon });
      }
    });
    setSections(parsedSections);
    setAnimationFinished(false); // Reset animation status
    if (isNew) {
      setDisplayedContent(parsedSections.map(() => '')); // Start with empty content for animation
    } else {
      setDisplayedContent(parsedSections.map(s => s.content)); // Show full content if not new
      setAnimationFinished(true); // Mark as finished if not new
    }
  }, [content, isNew]);

  useEffect(() => {
    if (!isNew || animationFinished) {
      if (animationFinished) {
        onAnimationComplete?.(); // Notify parent when overall animation is finished
      }
      return;
    }

    let currentSection = 0;
    let currentChar = 0;
    let timeoutId: NodeJS.Timeout;

    const typeChar = () => {
      if (currentSection < sections.length) {
        const targetContent = sections[currentSection].content;
        if (currentChar < targetContent.length) {
          setDisplayedContent(prev => {
            const newDisplayed = [...prev];
            newDisplayed[currentSection] = targetContent.substring(0, currentChar + 1);
            return newDisplayed;
          });
          currentChar++;
          timeoutId = setTimeout(typeChar, 10); // Typing speed
        } else {
          // Section finished, move to next section after a short delay
          currentSection++;
          currentChar = 0;
          if (currentSection < sections.length) {
            timeoutId = setTimeout(typeChar, 300); // Delay between sections
          } else {
            setAnimationFinished(true); // All sections animated
          }
        }
      }
    };

    typeChar(); // Start typing

    return () => clearTimeout(timeoutId);
  }, [isNew, sections, animationFinished, onAnimationComplete]);

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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayedContent[index]}
            </ReactMarkdown>
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
            <Button variant="outline" size="sm" onClick={onRequestChanges} disabled={isNew && !animationFinished}>
              <ThumbsDown className="h-4 w-4 mr-2" />
              Solicitar Cambios
            </Button>
            <Button size="sm" onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white" disabled={isNew && !animationFinished}>
              <ThumbsUp className="h-4 w-4 mr-2" />
              Aprobar y Construir
            </Button>
          </>
        )}
      </div>
    </div>
  );
}