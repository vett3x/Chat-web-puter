"use client";

import React from 'react';
import ProfileCard from '@/components/ProfileCard';
import '@/components/ProfileCard.css';
import { LandingFooter } from '@/components/landing-footer';
import PillNav from '@/components/PillNav';
import { useRouter } from 'next/navigation';

const teamMembers = [
  {
    name: "Javi A. Torres",
    title: "Software Engineer & Founder",
    handle: "javicodes",
    status: "Online",
    contactText: "Contactar",
    avatarUrl: "https://i.pravatar.cc/500?u=javier",
    showUserInfo: true,
    enableTilt: true,
  },
  {
    name: "Sofía Pérez",
    title: "AI Specialist & Co-Founder",
    handle: "sofia_ai",
    status: "Developing",
    contactText: "Contactar",
    avatarUrl: "https://i.pravatar.cc/500?u=sofia",
    showUserInfo: true,
    enableTilt: true,
  },
];

export default function AboutPage() {
  const router = useRouter();

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
        <div className="flex flex-wrap justify-center items-center gap-16">
          {teamMembers.map((member, index) => (
            <ProfileCard
              key={index}
              {...member}
              onContactClick={() => console.log(`Contact clicked for ${member.name}`)}
            />
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}