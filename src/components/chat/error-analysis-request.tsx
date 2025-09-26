"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, BrainCircuit, MessageSquareText, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface ErrorAnalysisRequestProps {
  content: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
}

interface RequestSection {
  title: string;
  content: string;
  icon: React.ReactNode;
}

export function ErrorAnalysisRequest({ content, isNew, onAnimationComplete }: ErrorAnalysisRequestProps) {
  const [sections, setSections] = useState<RequestSection[]>([]);
  const [animatedSectionsCount, setAnimatedSectionsCount] = useState(0);

  const sectionMappings = [
    { title: "Entendido", icon: <Check className="h-5 w-5 text-green-400" /> },
    { title: "Contexto del Error", icon: <AlertTriangle className="h-5 w-5 text-red-400" /> },
    { title: "Información Requerida", icon: <MessageSquareText className="h-5 w-5 text-blue-400" /> },
    { title: "Siguientes Pasos", icon: <BrainCircuit className="h-5 w-5 text-purple-400" /> },
  ];

  useEffect(() => {
    const rawSections = content.split(/###\s*💡?\s*/).slice(1);
    const parsedSections: RequestSection[] = [];

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

  return (
    <div className="space-y-4 max-w-full">
      <h3 className="text-lg font-semibold text-foreground">Solicitud de Análisis de Error</h3>
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
          <div className="prose prose-sm dark:prose-invert max-w-none pl-7 text-muted-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}