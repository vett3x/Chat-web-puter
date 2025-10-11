"use client";

import React, { useState, useEffect } from 'react';
import ProfileCard from '@/components/ProfileCard';
import '@/components/ProfileCard.css';
import { LandingFooter } from '@/components/landing-footer';
import PillNav from '@/components/PillNav';
import { useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ContactDialog } from '@/components/landing/ContactDialog';

interface TeamMember {
  id: string;
  name: string;
  title: string;
  handle: string;
  status: string;
  contact_text: string;
  avatar_url: string;
}

export default function AboutPage() {
  const router = useRouter();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) {
        toast.error('No se pudo cargar la información del equipo.');
        console.error(error);
      } else {
        setTeamMembers(data);
      }
      setIsLoading(false);
    };

    fetchTeamMembers();
  }, []);

  return (
    <div className="min-h-screen bg-background text-white">
      <header className="absolute top-0 left-0 right-0 z-50 p-4">
        <PillNav onCtaClick={() => router.push('/login')} />
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Sobre DeepAI Coder</h1>
            <p className="mt-4 max-w-3xl mx-auto text-lg text-white/70">
              Nacimos de la pasión por la programación y la fascinación por el potencial de la inteligencia artificial para transformar la forma en que creamos software.
            </p>
          </div>

          <div className="prose prose-invert max-w-none mb-24">
            <h2>Nuestra Historia</h2>
            <p>
              DeepAI Coder nació de una frustración compartida por muchos desarrolladores: la enorme brecha entre una idea brillante y un prototipo funcional. Horas incontables dedicadas a configurar entornos, escribir código repetitivo y gestionar infraestructuras complejas antes de poder siquiera empezar a construir la funcionalidad principal.
            </p>
            <p>
              Nos preguntamos: ¿Y si pudiéramos usar la IA no solo para escribir fragmentos de código, sino para actuar como un verdadero copiloto de desarrollo, capaz de entender una visión y materializarla en una aplicación completa y desplegada? ¿Y si pudiéramos darle a este copiloto el control de su propio entorno de desarrollo seguro?
            </p>
            <p>
              Con esa visión, empezamos a construir una plataforma que integra un asistente de IA conversacional con un entorno de desarrollo en la nube completamente gestionado. El resultado es DeepAI Coder: un lugar donde las ideas se convierten en software funcional a la velocidad del pensamiento.
            </p>

            <Separator className="my-8 bg-white/10" />

            <h2>Nuestra Misión: Qué nos hace diferentes</h2>
            <p>
              No somos solo otro generador de código. Nuestra misión es revolucionar el ciclo de vida del desarrollo de software a través de una simbiosis real entre el desarrollador y la IA.
            </p>
            <ul>
              <li>
                <strong>Simbiosis Humano-IA:</strong> Creemos que la IA es más poderosa cuando actúa como un socio, no como un reemplazo. Nuestra plataforma está diseñada para un diálogo continuo, donde tú proporcionas la visión creativa y la IA se encarga de la ejecución técnica, permitiéndote iterar y refinar a una velocidad sin precedentes.
              </li>
              <li>
                <strong>Infraestructura Integrada:</strong> Olvídate de configurar servidores, bases de datos o pipelines de despliegue. DeepAI Coder aprovisiona y gestiona toda la infraestructura necesaria en contenedores Docker aislados, permitiéndote enfocarte exclusivamente en tu producto.
              </li>
              <li>
                <strong>Control Total y Propiedad:</strong> Aunque la IA construye por ti, tú siempre tienes el control. Puedes acceder, modificar y descargar todo el código fuente de tu proyecto en cualquier momento. No hay cajas negras ni dependencias ocultas. Tu código es tuyo.
              </li>
              <li>
                <strong>Seguridad y Transparencia:</strong> La seguridad es fundamental. Todas las operaciones de la IA se ejecutan en un entorno aislado y se rigen por una estricta lista blanca de comandos seguros. Además, tienes un historial completo de cada acción realizada por el asistente, proporcionando una transparencia total.
              </li>
            </ul>
          </div>

          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Nuestro Equipo</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-white/70">
              Conoce a las mentes creativas detrás de DeepAI Coder.
            </p>
          </div>
          {isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin" />
            </div>
          ) : (
            <div className="flex flex-wrap justify-center items-center gap-16">
              {teamMembers.map((member) => (
                <ProfileCard
                  key={member.id}
                  name={member.name}
                  title={member.title}
                  handle={member.handle}
                  status={member.status}
                  contactText={member.contact_text}
                  avatarUrl={member.avatar_url}
                  showUserInfo={true}
                  enableTilt={true}
                  onContactClick={() => console.log(`Contact clicked for ${member.name}`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <LandingFooter onContactClick={() => setIsContactDialogOpen(true)} />
      <ContactDialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen} />
    </div>
  );
}