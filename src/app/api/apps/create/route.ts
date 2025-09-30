export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { provisionApp } from '@/lib/app-provisioning';

const createAppSchema = z.object({
  name: z.string().min(3, { message: 'El nombre del proyecto debe tener al menos 3 caracteres.' }).max(50),
  main_purpose: z.string().min(10, { message: 'El propósito principal debe tener al menos 10 caracteres.' }), // NEW
  key_features: z.string().optional(), // NEW
  preferred_technologies: z.string().optional(), // NEW
});

export async function POST(req: NextRequest) {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { name, main_purpose, key_features, preferred_technologies } = createAppSchema.parse(body); // Parse new fields

    // 1. Create a conversation for the app
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: `Chat para: ${name}` })
      .select('id')
      .single();
    if (convError) throw new Error(`Error al crear la conversación: ${convError.message}`);

    // 2. Create the app record in the database with 'provisioning' status
    const { data: newApp, error: appError } = await supabase
      .from('user_apps')
      .insert({
        user_id: userId,
        name: name,
        conversation_id: conversation.id,
        status: 'provisioning',
        prompt: main_purpose, // Keep prompt for backward compatibility, but use main_purpose
        main_purpose: main_purpose, // NEW
        key_features: key_features, // NEW
        preferred_technologies: preferred_technologies, // NEW
      })
      .select('*')
      .single();
    if (appError) throw new Error(`Error al crear el registro de la aplicación: ${appError.message}`);

    // 3. Insert an initial user message to guide the AI
    const initialUserPrompt = `Mi proyecto se llama "${name}".
Propósito Principal: ${main_purpose}
${key_features ? `Características Clave: ${key_features}` : ''}
${preferred_technologies ? `Tecnologías Preferidas: ${preferred_technologies}` : ''}

Por favor, genera un "Plan de Construcción" para una aplicación web básica con una barra de navegación, una página principal y un pie de página, utilizando Next.js, TypeScript y Tailwind CSS.`;

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: 'user',
      content: initialUserPrompt,
      type: 'text',
      is_construction_plan: false,
      plan_approved: false,
      is_correction_plan: false,
      correction_approved: false,
    });
    if (messageError) {
      console.error('Error inserting initial message:', messageError);
      // Don't block app creation, but log the error
    }

    // 4. Trigger the provisioning process in the background (don't await it)
    provisionApp({
      appId: newApp.id,
      userId: userId,
      appName: newApp.name,
      conversationId: newApp.conversation_id!,
      mainPurpose: main_purpose, // Pass new fields
      keyFeatures: key_features,
      preferredTechnologies: preferred_technologies,
    });

    // 5. Return the newly created app data immediately
    return NextResponse.json(newApp, { status: 201 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API /apps/create] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}