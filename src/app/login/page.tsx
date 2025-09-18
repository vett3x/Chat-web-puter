"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


export default function LoginPage() {
  const spanishLocalization = {
    variables: {
      sign_in: {
        email_label: 'Correo electrónico',
        password_label: 'Contraseña',
        email_input_placeholder: 'Tu correo electrónico',
        password_input_placeholder: 'Tu contraseña',
        button_label: 'Iniciar sesión',
        social_auth_typography: 'O continuar con',
        link_text: '¿Ya tienes una cuenta? Inicia sesión',
        forgotten_password_text: '¿Olvidaste tu contraseña?',
        no_account_text: '¿No tienes una cuenta? Regístrate',
      },
      sign_up: {
        email_label: 'Correo electrónico',
        password_label: 'Contraseña',
        email_input_placeholder: 'Tu correo electrónico',
        password_input_placeholder: 'Crea una contraseña',
        button_label: 'Registrarse',
        social_auth_typography: 'O continuar con',
        link_text: '¿Ya tienes una cuenta? Inicia sesión',
      },
      forgotten_password: {
        email_label: 'Correo electrónico',
        email_input_placeholder: 'Tu correo electrónico',
        button_label: 'Enviar instrucciones de recuperación',
        link_text: '¿Recordaste tu contraseña? Inicia sesión',
      },
      update_password: {
        password_label: 'Nueva contraseña',
        password_input_placeholder: 'Tu nueva contraseña',
        button_label: 'Actualizar contraseña',
      },
      magic_link: {
        email_input_placeholder: 'Tu correo electrónico',
        button_label: 'Enviar enlace mágico',
        link_text: 'Enviar un enlace mágico por correo electrónico',
      },
    },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bienvenido</CardTitle>
          <CardDescription>Inicia sesión o regístrate para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary-foreground))',
                  },
                },
              },
            }}
            theme="dark"
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/` : undefined}
            lang="es"
            localization={{
              variables: spanishLocalization.variables,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}