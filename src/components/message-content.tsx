"use client";

import React, { useState, useEffect } from 'react';
import { CodeBlock } from './code-block';
import { TextAnimator } from './text-animator';
import Image from 'next/image';
import { RenderablePart } from '@/lib/utils'; // Importar RenderablePart desde utils
import { ConstructionPlan } from './chat/construction-plan'; // Importar ConstructionPlan
import { ErrorAnalysisRequest } from './chat/error-analysis-request'; // NEW: Import ErrorAnalysisRequest
import { CorrectionPlan } from './chat/correction-plan'; // NEW: Import CorrectionPlan

interface MessageContentProps {
  content: string | RenderablePart[]; // MODIFICADO: Ahora acepta string o RenderablePart[]
  isNew?: boolean;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
  isAppChat?: boolean;
  isConstructionPlan?: boolean; // NEW: Prop para indicar si el contenido es un plan de construcción
  planApproved?: boolean; // NEW: Prop para indicar si el plan ha sido aprobado
  onApprovePlan?: (messageId: string) => void; // NEW: Callback para aprobar el plan
  onRequestChanges?: () => void; // NEW: Callback para solicitar cambios
  messageId?: string; // NEW: ID del mensaje para pasar al ConstructionPlan
  onAnimationComplete?: () => void; // NEW: Callback para cuando la animación de MessageContent termina
  isErrorAnalysisRequest?: boolean; // NEW: Prop para indicar si el contenido es una solicitud de análisis de error
  isCorrectionPlan?: boolean; // NEW: Prop para indicar si el contenido es un plan de corrección
  correctionApproved?: boolean; // NEW: Prop para indicar si el plan de corrección ha sido aprobado
}

export function MessageContent({ 
  content, 
  isNew, 
  aiResponseSpeed, 
  isAppChat, 
  isConstructionPlan, 
  planApproved, 
  onApprovePlan, 
  onRequestChanges, 
  messageId,
  onAnimationComplete,
  isErrorAnalysisRequest,
  isCorrectionPlan, // NEW: Destructure new prop
  correctionApproved, // NEW: Destructure new prop
}: MessageContentProps) {
  const [animatedPartsCount, setAnimatedPartsCount] = useState(0);

  // Helper to render a single part
  const renderPart = (part: RenderablePart, index: number, isAnimating: boolean, onComplete?: () => void) => {
    if (part.type === 'text') {
      return (
        <TextAnimator
          key={index}
          text={part.text || ''}
          className="whitespace-pre-wrap"
          isNew={isAnimating}
          onAnimationComplete={onComplete}
          animationSpeed={aiResponseSpeed}
        />
      );
    } else if (part.type === 'image_url') {
      return (
        <div key={index} className="my-2 rounded-lg overflow-hidden max-w-xs border border-border">
          <Image
            src={part.image_url.url}
            alt="Contenido de imagen"
            width={300}
            height={300}
            objectFit="contain"
            className="w-full h-auto"
          />
        </div>
      );
    } else if (part.type === 'code') {
      return (
        <CodeBlock
          key={index}
          language={part.language || ''}
          filename={part.filename}
          code={part.code || ''}
          isNew={isAnimating}
          onAnimationComplete={onComplete}
          animationSpeed={aiResponseSpeed}
        />
      );
    }
    return null;
  };

  // El componente ahora espera partes pre-procesadas o una cadena.
  const renderableParts = React.useMemo(() => {
    if (Array.isArray(content)) {
      return content;
    }
    // Si es una cadena, la convertimos en una parte de texto simple.
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }] as RenderablePart[];
    }
    return [];
  }, [content]);

  useEffect(() => {
    if (isNew) {
      setAnimatedPartsCount(0);
    }
  }, [isNew, content]);

  const handlePartAnimationComplete = () => {
    // No hay setTimeout aquí, la siguiente parte se anima inmediatamente
    // después de que la actual notifica su finalización.
    setAnimatedPartsCount(prev => prev + 1);
  };

  // NEW: More robust detection logic for special message types
  const looksLikeConstructionPlan = isConstructionPlan || (isAppChat && typeof content === 'string' && content.includes('### 1. Análisis del Requerimiento'));
  const looksLikeErrorAnalysisRequest = isErrorAnalysisRequest || (typeof content === 'string' && content.includes('### 💡 Entendido!'));
  const looksLikeCorrectionPlan = isCorrectionPlan || (typeof content === 'string' && content.includes('### 💡 Error Detectado'));

  // Render ErrorAnalysisRequest directly if it's an error analysis request
  if (looksLikeErrorAnalysisRequest && typeof content === 'string') {
    return (
      <ErrorAnalysisRequest
        content={content}
        isNew={isNew}
        onAnimationComplete={onAnimationComplete}
      />
    );
  }

  // Render CorrectionPlan directly if it's a correction plan
  if (looksLikeCorrectionPlan && typeof content === 'string' && messageId && onApprovePlan && onRequestChanges) {
    return (
      <CorrectionPlan
        content={content}
        onApprove={() => onApprovePlan(messageId)} // Reusing onApprovePlan for now
        onRequestManualFix={onRequestChanges} // Reusing onRequestChanges for now
        isApproved={!!correctionApproved}
        isNew={isNew}
        onAnimationComplete={onAnimationComplete}
      />
    );
  }

  // Render ConstructionPlan directly if it's a plan
  if (looksLikeConstructionPlan && typeof content === 'string' && messageId && onApprovePlan && onRequestChanges) {
    return (
      <ConstructionPlan
        content={content}
        onApprove={() => onApprovePlan(messageId)}
        onRequestChanges={onRequestChanges}
        isApproved={!!planApproved}
        isNew={isNew} // Pass isNew to ConstructionPlan
        onAnimationComplete={onAnimationComplete} // Pass onAnimationComplete
      />
    );
  }

  // If not new, render all parts immediately
  if (!isNew) {
    return (
      <>
        {renderableParts.map((part, index) => (
          renderPart(part, index, false)
        ))}
      </>
    );
  }

  // If new, animate parts sequentially
  return (
    <>
      {renderableParts.map((part, index) => {
        if (index > animatedPartsCount) {
          return null;
        }

        const isPartAnimating = index === animatedPartsCount;
        return renderPart(part, index, isPartAnimating, handlePartAnimationComplete);
      })}
    </>
  );
}