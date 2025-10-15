"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wand2, LayoutDashboard, CreditCard, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gsap } from 'gsap';
import { useSession } from '@/components/session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PillNavProps {
  onCtaClick: () => void;
}

export default function PillNav({ onCtaClick }: PillNavProps) {
  const router = useRouter();
  const { session, userAvatarUrl } = useSession();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    gsap.to('main', {
      opacity: 0,
      y: -20,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        router.push(href);
      }
    });
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error al cerrar sesión.');
    } else {
      toast.success('Sesión cerrada correctamente.');
      router.push('/'); // Redirect to landing page after sign out
    }
  };

  return (
    <nav className="flex items-center justify-between max-w-4xl mx-auto p-2 rounded-full bg-black/30 backdrop-blur-lg border border-white/10">
      <Link href="/" className="flex items-center gap-2 text-white pl-4">
        <Wand2 className="h-6 w-6 text-primary-light-purple" />
        <span className="font-bold text-lg">DeepAI Coder</span>
      </Link>
      <div className="flex items-center gap-2">
        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userAvatarUrl || ''} alt="Avatar de usuario" />
                  <AvatarFallback>
                    <User />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Sesión iniciada</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/app')}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Ir a la App</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Ver Planes</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button variant="ghost" asChild className="text-white hover:bg-white/10">
              <Link href="/login" onClick={(e) => handleNavClick(e, '/login')}>Iniciar Sesión</Link>
            </Button>
            <Button asChild className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white rounded-full">
              <Link href="/register" onClick={(e) => handleNavClick(e, '/register')}>Registrarse</Link>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}