"use client";

import { ContactForm } from '@/components/landing/ContactForm';
import PillNav from '@/components/PillNav';
import { LandingFooter } from '@/components/landing-footer';
import Aurora from '@/components/Aurora';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ContactPage() {
  const router = useRouter();
  return (
    <div className="relative min-h-screen bg-[#060010] text-white">
      <div className="absolute inset-0 z-0">
        <Aurora
          colorStops={["#3A29FF", "#FF94B4", "#FF3232"]}
          blend={0.5}
          amplitude={1.0}
          speed={0.5}
        />
      </div>
      <header className="absolute top-0 left-0 right-0 z-50 p-4">
        <PillNav onCtaClick={() => router.push('/login')} />
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-32 flex items-center justify-center min-h-screen">
        <div className="max-w-3xl w-full z-10">
          <Button asChild variant="ghost" className="mb-8">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Link>
          </Button>
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Contáctanos</h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-white/70">
              Estamos aquí para ayudarte. Envíanos un mensaje y nos pondremos en contacto contigo.
            </p>
          </div>
          <div className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-lg p-8">
            <ContactForm />
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}