import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPERUSER_EMAILS } from '@/lib/constants'; // Importación actualizada

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
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userPermissions: Record<string, boolean> = {}; // Initialize permissions object

  if (session?.user?.id) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, permissions') // Select permissions
      .eq('id', session.user.id)
      .single();
    if (profile) {
      userRole = profile.role as 'user' | 'admin' | 'super_admin';
      userPermissions = profile.permissions || {}; // Assign permissions
    } else if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin'; // Fallback for initial Super Admin
      // For super_admin fallback, grant all permissions
      userPermissions = {
        can_create_server: true,
        can_manage_docker_containers: true,
        can_manage_cloudflare_domains: true,
        can_manage_cloudflare_tunnels: true,
      };
    }
  }

  const publicPaths = ['/login']; // Rutas accesibles sin autenticación

  if (!session && !publicPaths.includes(req.nextUrl.pathname)) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set(`redirectedFrom`, req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Example of role-based redirection (optional, can be expanded)
  // If a 'user' tries to access an admin-only page, redirect them.
  // For now, we'll rely on API handlers for fine-grained access control.
  // if (userRole === 'user' && req.nextUrl.pathname.startsWith('/admin-only-page')) {
  //   const redirectUrl = req.nextUrl.clone();
  //   redirectUrl.pathname = '/'; // Redirect to home or a forbidden page
  //   return NextResponse.redirect(redirectUrl);
  // }

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