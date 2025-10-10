"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Wand2, Check, Play } from 'lucide-react';
import Aurora from '@/components/Aurora';
import { LandingFooter } from '@/components/landing-footer';
import Link from 'next/link';
import ElectricBorder from '@/components/ElectricBorder';
import GradualBlur from '@/components/GradualBlur';
import PillNav from '@/components/PillNav';
import CardSwap, { Card } from '@/components/CardSwap';
import { TechnologyLogos } from '@/components/landing/TechnologyLogos';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';

export default function LandingPage() {
  const router = useRouter();
  const mainContentRef = useRef(null);

  const handleStartClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    gsap.to(mainContentRef.current, {
      opacity: 0,
      y: -20,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        router.push('/start');
      }
    });
  };

  const pricingPlans = [
    {
      name: 'Hobby',
      price: '$0',
      description: 'Para proyectos personales y experimentación.',
      features: [
        '1 Proyecto Activo',
        'Asistente de IA y Notas Inteligentes',
        'Recursos Limitados (0.5 CPU, 512MB RAM)',
        '250 MB de Almacenamiento',
        'Despliegue con Subdominio',
        'Soporte Comunitario',
      ],
      cta: 'Empezar Gratis',
      href: '/start'
    },
    {
      name: 'Pro',
      price: '$25',
      description: 'Para desarrolladores serios y freelancers.',
      features: [
        '10 Proyectos Activos',
        'Recursos Ampliados (2 CPU, 2GB RAM)',
        '5 GB de Almacenamiento',
        'Proyectos Siempre Activos',
        'Dominio Personalizado',
        'Backups Automáticos',
        'Soporte Prioritario',
      ],
      cta: 'Empezar Ahora',
      href: '/start',
      highlight: true,
      badge: 'Más Popular',
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

  const testimonials = [
    {
      name: 'Ana, Desarrolladora Full-Stack',
      avatar: '/avatars/ana.jpg',
      quote: 'DeepAI Coder redujo mi tiempo de prototipado a la mitad. Es como tener un desarrollador junior súper rápido a mi lado, permitiéndome enfocar en la lógica de negocio compleja.'
    },
    {
      name: 'Carlos, Freelancer',
      avatar: '/avatars/carlos.jpg',
      quote: 'La capacidad de gestionar servidores, bases de datos y despliegues desde un solo lugar es increíble. Me ahorra horas de configuración y mantenimiento cada semana.'
    },
    {
      name: 'Sofía, Manager de Producto',
      avatar: '/avatars/sofia.jpg',
      quote: 'Pude validar una idea de producto y tener un MVP funcional en un fin de semana, sin escribir una sola línea de código yo misma. ¡Absolutamente revolucionario!'
    }
  ];

  const faqs = [
    {
      question: '¿Puedo exportar el código generado por la IA?',
      answer: '¡Sí! En cualquier momento puedes descargar un archivo .tar.gz con todo el código fuente de tu proyecto. Eres el dueño de tu código.'
    },
    {
      question: '¿Qué tecnologías puedo usar?',
      answer: 'Actualmente, nos especializamos en el stack de Next.js, TypeScript y Tailwind CSS, desplegado en un entorno Docker. Esto nos permite ofrecer una experiencia optimizada y de alto rendimiento. Estamos trabajando para añadir más tecnologías en el futuro.'
    },
    {
      question: '¿Cómo funciona el despliegue?',
      answer: 'El despliegue es automático. Utilizamos Cloudflare Tunnels para exponer de forma segura tu aplicación al mundo a través de un subdominio o tu propio dominio personalizado, dependiendo de tu plan.'
    },
    {
      question: '¿Es seguro?',
      answer: 'La seguridad es nuestra máxima prioridad. Cada aplicación se ejecuta en un contenedor Docker aislado. Además, contamos con una lista blanca de comandos seguros que la IA puede ejecutar para prevenir cualquier acción maliciosa.'
    }
  ];

  const [showFooterBlur, setShowFooterBlur] = useState(true);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (footerRef.current) {
        const footerTop = footerRef.current.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        if (footerTop < windowHeight) {
          setShowFooterBlur(false);
        } else {
          setShowFooterBlur(true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="bg-[#060010] text-white">
      <PillNav
        items={[
          { label: 'Precios', href: '#pricing' },
          { label: 'Contacto', href: '#contact' },
          { label: 'Iniciar Sesión', href: '/login' }
        ]}
        activeHref="/"
        baseColor="#0A021A"
        pillColor="hsl(var(--primary-light-purple))"
        hoveredPillTextColor="#FFFFFF"
        pillTextColor="#FFFFFF"
      />
      <main className="overflow-hidden" ref={mainContentRef}>
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
              De la Idea al Despliegue en Minutos, con IA.
            </h1>
            <p className="mt-4 max-w-3xl mx-auto text-lg text-white/70">
              Olvida la configuración compleja. Describe tu app, y deja que la IA construya, gestione y despliegue por ti.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="bg-primary-light-purple/20 hover:bg-primary-light-purple/30 backdrop-blur-md border border-primary-light-purple/30 text-white font-semibold text-lg px-8 py-6 rounded-full">
                <Link href="/start" onClick={handleStartClick}>Empezar a Construir Ahora</Link>
              </Button>
              <p className="mt-3 text-sm text-white/50">No se requiere tarjeta de crédito para el plan Hobby.</p>
            </div>
          </div>
        </section>

        {/* Features Section with CardSwap */}
        <section id="features" className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-16">
            <div className="md:w-1/2 text-center md:text-left">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Una Plataforma, Infinitas Posibilidades</h2>
              <p className="mt-4 text-lg text-white/70">
                Desde la idea hasta el despliegue, DeepAI Coder te proporciona las herramientas para construir rápidamente, con la ayuda de una IA que entiende tu visión.
              </p>
            </div>
            <div className="md:w-1/2 h-[400px] flex items-center justify-center">
              <CardSwap
                width={400}
                height={320}
                cardDistance={50}
                verticalDistance={60}
                delay={4000}
                pauseOnHover={true}
              >
                <Card className="p-6 flex flex-col justify-center items-center text-center bg-black/50 border-white/20 backdrop-blur-sm pointer-events-auto">
                  <h3 className="text-xl font-bold text-primary-light-purple mb-2">1. Describe tu Idea</h3>
                  <p className="text-white/80">Transforma tus ideas en código funcional con un copiloto que escribe y depura por ti.</p>
                </Card>
                <Card className="p-6 flex flex-col justify-center items-center text-center bg-black/50 border-white/20 backdrop-blur-sm pointer-events-auto">
                  <h3 className="text-xl font-bold text-primary-light-purple mb-2">2. La IA Construye por Ti</h3>
                  <p className="text-white/80">Gestiona servidores, bases de datos y despliegues desde una única interfaz.</p>
                </Card>
                <Card className="p-6 flex flex-col justify-center items-center text-center bg-black/50 border-white/20 backdrop-blur-sm pointer-events-auto">
                  <h3 className="text-xl font-bold text-primary-light-purple mb-2">3. Despliega al Instante</h3>
                  <p className="text-white/80">Publica tus aplicaciones en la web con un solo clic, sin configuraciones complejas.</p>
                </Card>
              </CardSwap>
            </div>
          </div>
        </section>

        {/* Demo Video Section */}
        <section className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ver para Creer</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-white/70">
              Observa cómo DeepAI Coder transforma un simple prompt en una aplicación funcional en tiempo real.
            </p>
            <div className="mt-12 aspect-video max-w-4xl mx-auto bg-black/30 border border-white/20 rounded-xl flex items-center justify-center cursor-pointer group">
              <div className="bg-white/10 group-hover:bg-white/20 transition-colors rounded-full p-6">
                <Play className="h-12 w-12 text-white" />
              </div>
            </div>
          </div>
        </section>

        {/* Trusted Technologies Section */}
        <section className="py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="text-sm font-semibold text-white/60 tracking-wider uppercase">Construido con Tecnologías de Confianza</h3>
            <div className="mt-8">
              <TechnologyLogos />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24">
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
                  className="bg-[#0A021A] h-full relative"
                >
                  {plan.badge && (
                    <div className="absolute -top-3 right-4 bg-primary-light-purple text-white text-xs font-bold px-3 py-1 rounded-full">
                      {plan.badge}
                    </div>
                  )}
                  <div className="text-left flex flex-col h-full p-6">
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

        {/* Testimonials Section */}
        <section className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">Amado por Desarrolladores y Creadores</h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((testimonial) => (
                <div key={testimonial.name} className="bg-black/30 border border-white/10 p-6 rounded-lg">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar>
                      <AvatarImage src={testimonial.avatar} />
                      <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{testimonial.name.split(',')[0]}</p>
                      <p className="text-sm text-white/60">{testimonial.name.split(',')[1]}</p>
                    </div>
                  </div>
                  <p className="text-white/80">"{testimonial.quote}"</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">Preguntas Frecuentes</h2>
            <Accordion type="single" collapsible className="w-full mt-12">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-white/70">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <GradualBlur 
          preset="page-footer" 
          style={{ opacity: showFooterBlur ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }} 
        />
      </main>
      <LandingFooter ref={footerRef} />
    </div>
  );
}