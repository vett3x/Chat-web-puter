export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants';

// Helper function to get the session and user role
async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null; userPermissions: UserPermissions }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userPermissions: UserPermissions = {};

  if (session?.user?.id) {
    // First, determine the role, prioritizing SUPERUSER_EMAILS
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
    } else {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role') // Only need role for initial determination
        .eq('id', session.user.id)
        .single();
      if (profile) {
        userRole = profile.role as 'user' | 'admin' | 'super_admin';
      } else {
        userRole = 'user'; // Default to user if no profile found and not superuser email
      }
    }

    // Then, fetch permissions from profile, or set all if super_admin
    if (userRole === 'super_admin') {
      for (const key of Object.values(PERMISSION_KEYS)) {
        userPermissions[key] = true;
      }
    } else {
      const { data: profilePermissions, error: permissionsError } = await supabase
        .from('profiles')
        .select('permissions')
        .eq('id', session.user.id)
        .single();
      if (profilePermissions) {
        userPermissions = profilePermissions.permissions || {};
      } else {
        // Default permissions for non-super-admin if profile fetch failed
        userPermissions = {
          [PERMISSION_KEYS.CAN_CREATE_SERVER]: false,
          [PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_DOMAINS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]: false,
        };
      }
    }
  }
  return { session, userRole, userPermissions };
}

export async function DELETE(
  req: NextRequest,
  context: any
) {
  const userId = context.params.id;
  const conversationId = context.params.conversationId;

  if (!userId || !conversationId) {
    return NextResponse.json({ message: 'ID de usuario o conversación no proporcionado.' }, { status: 400 });
  }

  const { session, userRole } = await getSessionAndRole();
  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado. Se requiere rol de Admin o Super Admin para eliminar conversaciones.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // First, verify the conversation belongs to the user
    const { data: conversation, error: fetchConvError } = await supabaseAdmin
      .from('conversations')
      .select('id, title')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (fetchConvError || !conversation) {
      console.error(`Error fetching conversation ${conversationId} for user ${userId}:`, fetchConvError);
      return NextResponse.json({ message: 'Conversación no encontrada o no pertenece a este usuario.' }, { status: 404 });
    }

    // Delete all messages associated with the conversation
    const { error: messagesError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (messagesError) {
      console.error(`Error deleting messages for conversation ${conversationId}:`, messagesError);
      throw new Error('Error al eliminar los mensajes de la conversación.');
    }

    // Delete the conversation itself
    const { error: conversationError } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (conversationError) {
      console.error(`Error deleting conversation ${conversationId}:`, conversationError);
      throw new Error('Error al eliminar la conversación.');
    }

    // Log the action
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'user_conversation_deleted_single',
      description: `Conversación '${conversation.title}' (ID: ${conversationId}) del usuario ${userId} eliminada por ${session.user.email}.`,
    });

    return NextResponse.json({ message: 'Conversación eliminada correctamente.' }, { status: 200 });

  } catch (error: any) {
    console.error(`Unhandled error in DELETE /api/users/${userId}/conversations/${conversationId}:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}