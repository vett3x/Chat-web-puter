"use client";

import React from 'react';
import MagicBento from '@/components/MagicBento';
import { Button } from '@/components/ui/button';
import { Wand2, Check } from 'lucide-react';
import Aurora from '@/components/Aurora';
import { LandingHeader } from '@/components/landing-header';
import { LandingFooter } from '@/components/landing-footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import ElectricBorder from '@/components/ElectricBorder';

export default function LandingPage() {
  const pricingPlans = [
    {
      name: 'Hobby',
      price: '$10',
      description: 'Para proyectos personales y experimentación.',
      features: ['1 Proyecto Activo', 'Soporte Básico', 'Despliegue con Subdominio'],
      cta: 'Empezar Ahora',
      href: '/login'
    },
    {
      name: 'Pro',
      price: '$49',
      description: 'Para desarrolladores serios y freelancers.',
      features: ['10 Proyectos Activos', 'Soporte Prioritario', 'Dominio Personalizado', 'Bases de Datos Dedicadas'],
      cta: 'Empezar Ahora',
      href: '/login',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Contacto',
      description: 'Para equipos y empresas que necesitan más.',
      features: ['Proyectos Ilimitados', 'Soporte Dedicado 24/7', 'Infraestructura Personalizada', 'SSO y Seguridad Avanzada'],
      cta: 'Contactar Ventas',
      href: '#contact'
    },
  ];

  return (
    <div className="bg-[#060010] text-white">
      <LandingHeader />
      <main className="overflow-hidden">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center min-h-screen pt-16">
          <div className="absolute inset-0 z-0">
            <Aurora
              colorStops={["#3A29FF", "#FF94B4", "#FF3232"]}
              blend={0.5}
              amplitude={1.0}
              speed={0.5}
            />
          </div>
          <div className="text-center z-10 p-4">
            <Wand2 className="h-12 w-12 mx-auto mb-4 text-primary-light-purple" />
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              Crea y Despliega Aplicaciones con tu Copiloto de IA
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-white/70">
              La plataforma todo en uno que convierte tus ideas en software real. Escribe, gestiona y despliega, todo desde una única interfaz.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white font-semibold text-lg px-8 py-6 rounded-full">
                <Link href="/login">Empezar a Construir Ahora</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Una Plataforma, Posibilidades Infinitas</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-white/70">
              Desde la idea hasta el despliegue, DeepAI Coder te proporciona todas las herramientas que necesitas.
            </p>
          </div>
          <div className="flex justify-center mt-12">
            <MagicBento 
              textAutoHide={true}
              enableStars={true}
              enableSpotlight={true}
              enableBorderGlow={true}
              enableTilt={true}
              enableMagnetism={true}
              clickEffect={true}
              spotlightRadius={300}
              particleCount={12}
              glowColor="132, 0, 255"
            />
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 bg-black/20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Planes Flexibles para Cada Necesidad</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-white/70">
              Nuestros planes de suscripción están diseñados para crecer contigo, garantizando un servicio de primera, seguro y en constante mejora.
            </p>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              {pricingPlans.map((plan) => (
                <ElectricBorder
                  key={plan.name}
                  color={plan.highlight ? 'hsl(var(--primary-light-purple))' : 'rgba(255, 255, 255, 0.3)'}
                  speed={1}
                  chaos={0.5}
                  thickness={1}
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  <div className="bg-[#0A021A] text-left flex flex-col h-full p-6 rounded-[var(--radius)]">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <p className="text-white/60">{plan.description}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-4xl font-bold mb-6">{plan.price}<span className="text-lg font-normal text-white/60">{plan.price.startsWith('$') ? '/mes' : ''}</span></p>
                      <ul className="space-y-3">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-white/80">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-auto pt-6">
                      <Button asChild className={`w-full ${plan.highlight ? 'bg-primary-light-purple hover:bg-primary-light-purple/90 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                        <Link href={plan.href}>{plan.cta}</Link>
                      </Button>
                    </div>
                  </div>
                </ElectricBorder>
              ))}
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}