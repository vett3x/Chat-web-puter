export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants';

const updateSecuritySchema = z.object({
  security_enabled: z.boolean().optional(),
  maintenance_mode_enabled: z.boolean().optional(),
  users_disabled: z.boolean().optional(), // NEW
  admins_disabled: z.boolean().optional(), // NEW
});

async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null; userPermissions: UserPermissions }> {
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

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userPermissions: UserPermissions = {};

  if (session?.user?.id) {
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      userRole = profile ? profile.role as 'user' | 'admin' | 'super_admin' : 'user';
    }

    if (userRole === 'super_admin') {
      for (const key of Object.values(PERMISSION_KEYS)) {
        userPermissions[key] = true;
      }
    } else {
      const { data: profilePermissions } = await supabase
        .from('profiles')
        .select('permissions')
        .eq('id', session.user.id)
        .single();
      userPermissions = profilePermissions ? profilePermissions.permissions || {} : {};
    }
  }
  return { session, userRole, userPermissions };
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('security_enabled, maintenance_mode_enabled, users_disabled, admins_disabled')
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      security_enabled: data?.security_enabled ?? true,
      maintenance_mode_enabled: data?.maintenance_mode_enabled ?? false,
      users_disabled: data?.users_disabled ?? false, // NEW
      admins_disabled: data?.admins_disabled ?? false, // NEW
    });
  } catch (error: any) {
    console.error('[API /settings/security GET] Error fetching security setting:', error);
    return NextResponse.json({ message: error.message || 'Error al obtener la configuración de seguridad.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsedBody = updateSecuritySchema.parse(body);

    const updateData: { [key: string]: any } = { // Use a flexible type for updateData
      updated_at: new Date().toISOString(),
    };

    if (parsedBody.security_enabled !== undefined) {
      updateData.security_enabled = parsedBody.security_enabled;
    }
    if (parsedBody.maintenance_mode_enabled !== undefined) {
      updateData.maintenance_mode_enabled = parsedBody.maintenance_mode_enabled;
    }
    if (parsedBody.users_disabled !== undefined) { // NEW
      updateData.users_disabled = parsedBody.users_disabled;
    }
    if (parsedBody.admins_disabled !== undefined) { // NEW
      updateData.admins_disabled = parsedBody.admins_disabled;
    }

    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .update(updateData)
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select('security_enabled, maintenance_mode_enabled, users_disabled, admins_disabled')
      .single();

    if (error) throw error;

    // Logging logic
    const logEntries = [];
    if (parsedBody.security_enabled !== undefined) {
      logEntries.push({ user_id: session.user.id, event_type: 'security_setting_updated', description: `Sistema de seguridad de comandos ${parsedBody.security_enabled ? 'activado' : 'desactivado'}.` });
    }
    if (parsedBody.maintenance_mode_enabled !== undefined) {
      logEntries.push({ user_id: session.user.id, event_type: 'maintenance_mode_updated', description: `Modo Mantenimiento ${parsedBody.maintenance_mode_enabled ? 'activado' : 'desactivado'}.` });
    }
    if (parsedBody.users_disabled !== undefined) { // NEW
      logEntries.push({ user_id: session.user.id, event_type: 'user_accounts_toggled', description: `Cuentas de Usuario ${parsedBody.users_disabled ? 'desactivadas' : 'activadas'}.` });
    }
    if (parsedBody.admins_disabled !== undefined) { // NEW
      logEntries.push({ user_id: session.user.id, event_type: 'admin_accounts_toggled', description: `Cuentas de Admin ${parsedBody.admins_disabled ? 'desactivadas' : 'activadas'}.` });
    }
    if (logEntries.length > 0) {
      await supabaseAdmin.from('server_events_log').insert(logEntries);
    }

    return NextResponse.json({ 
      message: `Configuración actualizada.`, 
      ...data
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API /settings/security PUT] Error updating security setting:', error);
    return NextResponse.json({ message: error.message || 'Error al actualizar la configuración de seguridad.' }, { status: 500 });
  }
}