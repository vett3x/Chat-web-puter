"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wand2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { gsap } from 'gsap';

export function LandingHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    gsap.to('main', { // Assuming the main content has a ref or can be targeted
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
    <header className="w-full z-50 py-4">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-white">
          <Wand2 className="h-7 w-7 text-primary-light-purple" />
          <span className="font-bold text-xl">DeepAI Coder</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-4">
          <Button variant="ghost" asChild className="text-white hover:bg-white/10">
            <Link href="/login" onClick={(e) => handleNavClick(e, '/login')}>Iniciar Sesión</Link>
          </Button>
          <Button asChild className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white rounded-full">
            <Link href="/start" onClick={(e) => handleNavClick(e, '/start')}>Registrarse</Link>
          </Button>
        </nav>

        {/* Mobile Nav Toggle */}
        <div className="md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden mt-4 bg-black/50 backdrop-blur-lg rounded-lg mx-4 overflow-hidden transition-all duration-300 ease-in-out",
          isMobileMenuOpen ? "max-h-screen p-4" : "max-h-0 p-0 border-none"
        )}
      >
        <nav className="flex flex-col gap-4">
          <Button variant="ghost" asChild className="text-white hover:bg-white/10 w-full">
            <Link href="/login" onClick={(e) => handleNavClick(e, '/login')}>Iniciar Sesión</Link>
          </Button>
          <Button asChild className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white rounded-full w-full">
            <Link href="/start" onClick={(e) => handleNavClick(e, '/start')}>Registrarse</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}