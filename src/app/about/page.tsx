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
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Nuestro Equipo</h1>
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
      </main>
      <LandingFooter />
    </div>
  );
}