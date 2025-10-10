"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gsap } from 'gsap';

interface PillNavProps {
  onCtaClick: () => void;
}

export default function PillNav({ onCtaClick }: PillNavProps) {
  const router = useRouter();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    gsap.to('main', {
      opacity: 0,
      y: -20,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        router.push(href);
      }
    });
  };

  return (
    <nav className="flex items-center justify-between w-full max-w-4xl mx-auto p-2 rounded-full bg-black/30 backdrop-blur-lg border border-white/10">
      <Link href="/" className="flex items-center gap-2 text-white pl-4">
        <Wand2 className="h-6 w-6 text-primary-light-purple" />
        <span className="font-bold text-lg">DeepAI Coder</span>
      </Link>
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild className="text-white hover:bg-white/10">
          <Link href="/login" onClick={(e) => handleNavClick(e, '/login')}>Iniciar Sesión</Link>
        </Button>
        <Button asChild className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white rounded-full">
          <Link href="/register" onClick={(e) => handleNavClick(e, '/register')}>Registrarse</Link>
        </Button>
      </div>
    </nav>
  );
}