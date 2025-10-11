"use client";

import React from 'react';
import Link from 'next/link';
import { Wand2 } from 'lucide-react';

export const LandingFooter = React.forwardRef<HTMLElement>((props, ref) => {
  return (
    <footer ref={ref} id="contact" className="w-full border-t border-white/10 mt-24 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Wand2 className="h-7 w-7 text-primary-light-purple" />
              <span className="text-xl font-bold text-white">DeepAI Coder</span>
            </Link>
            <p className="mt-4 text-sm text-white/60">
              Construyendo el futuro del desarrollo de software, una línea de código a la vez.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/80 tracking-wider uppercase">Producto</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="#features" className="text-sm text-white/60 hover:text-white">Características</Link></li>
              <li><Link href="#pricing" className="text-sm text-white/60 hover:text-white">Precios</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/80 tracking-wider uppercase">Compañía</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="#" className="text-sm text-white/60 hover:text-white">Sobre Nosotros</Link></li>
              <li><Link href="#" className="text-sm text-white/60 hover:text-white">Contacto</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/80 tracking-wider uppercase">Legal</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/privacy" className="text-sm text-white/60 hover:text-white">Privacidad</Link></li>
              <li><Link href="/terms" className="text-sm text-white/60 hover:text-white">Términos</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-8 text-center">
          <p className="text-sm text-white/50">&copy; {new Date().getFullYear()} DeepAI Coder. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
});

LandingFooter.displayName = 'LandingFooter';