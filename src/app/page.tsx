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
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Autoplay from "embla-carousel-autoplay";
import { gsap } from 'gsap';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { PayPalButtonsWrapper } from '@/components/paypal-buttons-wrapper'; // Importar el nuevo componente

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  price_period: string | null;
  description: string;
  features: string[];
  cta_text: string;
  cta_href: string;
  highlight: boolean;
  badge_text: string | null;
}

export default function LandingPage() {
  const router = useRouter();
  const mainContentRef = useRef(null);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch('/api/pricing-plans');
        if (!response.ok) throw new Error('Failed to fetch pricing plans');
        const data = await response.json();
        setPricingPlans(data);
      } catch (error) {
        console.error(error);
        // You might want to set some default plans here as a fallback
      } finally {
        setIsLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

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

  const handleLoginCtaClick = () => {
    gsap.to(mainContentRef.current, {
      opacity: 0,
      y: -20,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        router.push('/login');
      }
    });
  };

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
    <div className="bg-background text-white">
      <header className="absolute top-0 left-0 right-0 z-50 p-4">
        <PillNav onCtaClick={handleLoginCtaClick} />
      </header>
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
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4">
              Tu Visión, Potenciada por IA.
            </h1>
            <p className="mt-4 max-w-3xl mx-auto text-lg text-white/70">
              Crea aplicaciones, chatea con tus documentos, organiza tus ideas y gestiona tu infraestructura. Todo en un solo lugar.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="bg-primary-light-purple/20 hover:bg-primary-light-purple/30 backdrop-blur-md border border-primary-light-purple/30 text-white font-semibold text-lg px-8 py-6 rounded-full">
                <Link href="/start" onClick={handleStartClick}>Empezar Ahora</Link>
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
              {isLoadingPlans ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-[#0A021A] border border-white/10 rounded-lg p-6 flex flex-col">
                    <Skeleton className="h-6 w-1/2 mb-4" />
                    <Skeleton className="h-4 w-3/4 mb-6" />
                    <Skeleton className="h-10 w-1/3 mb-6" />
                    <div className="space-y-3 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <Skeleton className="h-12 w-full mt-6" />
                  </div>
                ))
              ) : (
                pricingPlans.map((plan) => (
                  <ElectricBorder
                    key={plan.id}
                    color={plan.highlight ? 'hsl(var(--primary-light-purple))' : 'rgba(255, 255, 255, 0.3)'}
                    speed={1}
                    chaos={0.5}
                    thickness={1}
                    style={{ borderRadius: 'var(--radius)' }}
                    className="bg-[#0A021A] h-full relative"
                  >
                    {plan.badge_text && (
                      <div className="absolute -top-3 right-4 bg-primary-light-purple text-white text-xs font-bold px-3 py-1 rounded-full">
                        {plan.badge_text}
                      </div>
                    )}
                    <div className="text-left flex flex-col h-full p-6">
                      <div className="mb-6">
                        <h3 className="text-xl font-bold">{plan.name}</h3>
                        <p className="text-white/60">{plan.description}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-4xl font-bold mb-6">{plan.price}<span className="text-lg font-normal text-white/60">{plan.price_period}</span></p>
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
                        {plan.price === 'Gratis' ? (
                          <Button asChild className={`w-full ${plan.highlight ? 'bg-primary-light-purple hover:bg-primary-light-purple/90 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                            <Link href={plan.cta_href}>{plan.cta_text}</Link>
                          </Button>
                        ) : (
                          <PayPalButtonsWrapper plan={plan} />
                        )}
                      </div>
                    </div>
                  </ElectricBorder>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">Amado por Desarrolladores y Creadores</h2>
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              plugins={[
                Autoplay({
                  delay: 5000,
                }),
              ]}
              className="w-full max-w-4xl mx-auto mt-12"
            >
              <CarouselContent>
                {testimonials.map((testimonial, index) => (
                  <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                    <div className="p-1 h-full">
                      <div className="bg-black/30 border border-white/10 p-6 rounded-lg h-full flex flex-col">
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
                        <p className="text-white/80 flex-1">"{testimonial.quote}"</p>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-[-50px] text-white bg-white/10 border-white/20 hover:bg-white/20" />
              <CarouselNext className="right-[-50px] text-white bg-white/10 border-white/20 hover:bg-white/20" />
            </Carousel>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">Preguntas Frecuentes</h2>
            <Accordion type="single" collapsible className="w-full mt-12 space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="bg-white/5 border border-white/10 rounded-lg px-6">
                  <AccordionTrigger className="text-left hover:no-underline">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-white/70 pt-2">
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