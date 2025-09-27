import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPERUSER_EMAILS, PERMISSION_KEYS, UserPermissions } from '@/lib/constants'; // Importación actualizada

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Inicializamos el cliente Supabase para el middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        },
        remove: (name: string, options: any) => {
          req.cookies.set(name, '');
          res.cookies.set(name, '', options);
        },
      },
    }
  ); // REMOVED: .schema('public')

  const {
    data: { session },
  } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userPermissions: UserPermissions = {}; // Initialize permissions object

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

  // NEW: Check for maintenance mode
  const { data: globalSettings, error: settingsError } = await supabase
    .from('global_settings')
    .select('maintenance_mode_enabled')
    .single();

  const maintenanceModeEnabled = globalSettings?.maintenance_mode_enabled ?? false;
  const isSuperAdmin = userRole === 'super_admin';

  const publicPaths = ['/login', '/maintenance']; // Rutas accesibles sin autenticación o en mantenimiento

  // If maintenance mode is enabled and user is not Super Admin, redirect to maintenance page
  if (maintenanceModeEnabled && !isSuperAdmin && !publicPaths.includes(req.nextUrl.pathname)) {
    // Invalidate session to ensure user is logged out and redirected
    if (session) {
      await supabase.auth.signOut();
    }
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/maintenance';
    return NextResponse.redirect(redirectUrl);
  }

  // If maintenance mode is NOT enabled, but user is on /maintenance page, redirect to home
  if (!maintenanceModeEnabled && req.nextUrl.pathname === '/maintenance') {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  // Standard authentication check (after maintenance mode check)
  if (!session && !publicPaths.includes(req.nextUrl.pathname)) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set(`redirectedFrom`, req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Store userRole and userPermissions in headers for access in API routes if needed,
  // though getSessionAndRole is called directly in API routes for robustness.
  // This is more for client-side context or logging in middleware.
  res.headers.set('x-user-role', userRole || 'none');
  res.headers.set('x-user-permissions', JSON.stringify(userPermissions));

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - any files in the public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};