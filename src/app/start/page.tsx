"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, MessageSquare, FileText, Server, Bot, Send, Loader2, ArrowLeft } from 'lucide-react';
import Aurora from '@/components/Aurora';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { gsap } from 'gsap';

const ONBOARDING_STORAGE_KEY = 'onboarding_action';

const actionChoices = [
  { key: 'create_app', title: 'Crear una nueva aplicación con IA', description: 'Describe tu idea y la construiré para ti.', icon: <Wand2 className="h-6 w-6" /> },
  { key: 'use_assistant', title: 'Usar el Asistente de IA', description: 'Chatea conmigo para resolver dudas o generar ideas.', icon: <MessageSquare className="h-6 w-6" /> },
  { key: 'take_notes', title: 'Tomar notas y organizar ideas', description: 'Usa mi cuaderno inteligente para guardar y consultar información.', icon: <FileText className="h-6 w-6" /> },
];

const appCreationQuestions = [
  { key: 'name', prompt: '¡Genial! Empecemos a construir. ¿Cómo se llamará tu aplicación?', placeholder: 'Ej: Mi increíble app de fotos' },
  { key: 'main_purpose', prompt: 'Perfecto. Ahora, ¿cuál es el propósito principal de tu aplicación? Sé lo más descriptivo posible.', placeholder: 'Ej: Una red social para compartir fotos de paisajes' },
  { key: 'key_features', prompt: 'Entendido. ¿Hay alguna característica clave o funcionalidad específica que te gustaría incluir? (Opcional)', placeholder: 'Ej: Perfiles de usuario, subida de imágenes, sistema de "me gusta"' },
];

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState('choose_action');
  const [userChoice, setUserChoice] = useState<string | null>(null);
  const [projectDetails, setProjectDetails] = useState({ name: '', main_purpose: '', key_features: '' });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const contentRef = useRef(null);

  // Animate content IN when step or question changes
  useEffect(() => {
    gsap.fromTo(contentRef.current, 
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.3 }
    );
  }, [step, currentQuestionIndex]);

  const animateOut = (callback: () => void) => {
    gsap.to(contentRef.current, {
      opacity: 0,
      y: -20,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: callback
    });
  };

  const handleActionChoice = (choice: string) => {
    animateOut(() => {
      setUserChoice(choice);
      if (choice === 'create_app') {
        setStep('define_app');
      } else {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ action: choice }));
        router.push('/register');
      }
    });
  };

  const handleNextQuestion = () => {
    const currentQuestion = appCreationQuestions[currentQuestionIndex];
    if (!userInput.trim() && currentQuestion.key !== 'key_features') {
      toast.error('Por favor, responde a la pregunta.');
      return;
    }

    animateOut(() => {
      setProjectDetails(prev => ({ ...prev, [currentQuestion.key]: userInput.trim() }));
      setUserInput('');
      if (currentQuestionIndex < appCreationQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        const finalDetails = { ...projectDetails, [currentQuestion.key]: userInput.trim() };
        localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ action: 'create_app', details: finalDetails }));
        router.push('/register');
      }
    });
  };

  const handleGoBack = () => {
    animateOut(() => {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(prev => prev - 1);
        // Restore previous input for editing
        const previousKey = appCreationQuestions[currentQuestionIndex - 1].key as keyof typeof projectDetails;
        setUserInput(projectDetails[previousKey]);
      } else {
        setStep('choose_action');
        setCurrentQuestionIndex(0);
        setProjectDetails({ name: '', main_purpose: '', key_features: '' });
        setUserInput('');
      }
    });
  };

  const handleGoBackToLanding = () => {
    animateOut(() => {
      router.push('/');
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNextQuestion();
    }
  };

  const renderContent = () => {
    if (step === 'choose_action') {
      return (
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Bienvenido a DeepAI Coder.</h1>
          <p className="text-lg text-white/70 mb-12">¿Qué te gustaría hacer hoy?</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {actionChoices.map((choice) => (
              <div
                key={choice.key}
                onClick={() => handleActionChoice(choice.key)}
                className="bg-white/5 border border-white/10 rounded-lg p-6 text-center cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className="inline-block p-3 bg-primary-light-purple/20 rounded-full mb-4">
                  {choice.icon}
                </div>
                <h3 className="text-lg font-semibold">{choice.title}</h3>
                <p className="text-sm text-white/60 mt-2">{choice.description}</p>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={handleGoBackToLanding} className="mt-12 text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a la página principal
          </Button>
        </div>
      );
    }

    if (step === 'define_app') {
      const { prompt, placeholder } = appCreationQuestions[currentQuestionIndex];
      return (
        <div className="w-full max-w-xl mx-auto text-center relative">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center shadow-md">
              <Bot className="h-6 w-6 text-secondary-foreground" />
            </div>
            <p className="text-xl font-medium text-foreground">{prompt}</p>
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="w-full resize-none min-h-24 bg-black/20 border-white/20 text-white placeholder:text-white/40"
              autoFocus
            />
            <div className="flex gap-4 mt-4">
              <Button variant="outline" onClick={handleGoBack} className="bg-transparent border-white/20 hover:bg-white/10 text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
              <Button onClick={handleNextQuestion} className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white">
                Siguiente <Send className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#060010] text-white p-4">
      <div className="absolute inset-0 z-0">
        <Aurora
          colorStops={["#3A29FF", "#FF94B4", "#FF3232"]}
          blend={0.5}
          amplitude={1.0}
          speed={0.5}
        />
      </div>
      <div ref={contentRef} className="z-10 w-full">
        {renderContent()}
      </div>
    </div>
  );
}