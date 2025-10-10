"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Wand2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: '#features', label: 'Características' },
    { href: '#pricing', label: 'Precios' },
    { href: '#contact', label: 'Contacto' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <Wand2 className="h-7 w-7 text-primary-light-purple" />
              <span className="text-xl font-bold text-white">DeepAI Coder</span>
            </Link>
          </div>
          <div className="hidden md:flex md:items-center md:gap-8">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium text-white/80 hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <Button asChild variant="outline" className="bg-transparent border-primary-light-purple text-primary-light-purple hover:bg-primary-light-purple hover:text-white">
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
          </div>
          <div className="md:hidden flex items-center">
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden absolute top-16 left-0 right-0 bg-black/80 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden',
          isMenuOpen ? 'max-h-screen border-t border-white/10' : 'max-h-0'
        )}
      >
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-white/80 hover:text-white hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 pb-2 px-3">
            <Button asChild variant="outline" className="w-full bg-transparent border-primary-light-purple text-primary-light-purple hover:bg-primary-light-purple hover:text-white">
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}