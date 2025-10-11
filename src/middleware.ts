import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPERUSER_EMAILS, PERMISSION_KEYS, UserPermissions } from '@/lib/constants';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
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

  const { data: { session } } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userStatus: 'active' | 'banned' | 'kicked' | null = null;
  let kickedAt: string | null = null;

  if (session?.user?.id) {
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
      userStatus = 'active';
    } else {
      const { data: profile } = await supabase.from('profiles').select('role, status, kicked_at').eq('id', session.user.id).single();
      userRole = profile ? profile.role as 'user' | 'admin' | 'super_admin' : 'user';
      userStatus = profile ? profile.status as 'active' | 'banned' | 'kicked' : 'active';
      kickedAt = profile?.kicked_at || null;
    }
  }

  const { data: globalSettings } = await supabase.from('global_settings').select('maintenance_mode_enabled, users_disabled, admins_disabled').single();

  const maintenanceModeEnabled = globalSettings?.maintenance_mode_enabled ?? false;
  const usersDisabled = globalSettings?.users_disabled ?? false;
  const adminsDisabled = globalSettings?.admins_disabled ?? false;
  const isSuperAdmin = userRole === 'super_admin';

  const publicPaths = ['/', '/start', '/login', '/register', '/maintenance', '/check-email'];
  const authRoutes = ['/login', '/register', '/start', '/check-email']; // Routes only for unauthenticated users
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname === path);

  if (maintenanceModeEnabled && !isSuperAdmin && !isPublicPath) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/maintenance';
    return NextResponse.redirect(redirectUrl);
  }

  if (!maintenanceModeEnabled && req.nextUrl.pathname === '/maintenance') {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  if (session && !isSuperAdmin) {
    let shouldBeKicked = false;
    let kickReason = '';

    if (userStatus === 'banned') {
      shouldBeKicked = true;
      kickReason = 'account_banned';
    } else if (userStatus === 'kicked') {
      const kickedTime = kickedAt ? new Date(kickedAt).getTime() : 0;
      const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);

      if (kickedTime > fifteenMinutesAgo) {
        shouldBeKicked = true;
        kickReason = 'account_kicked';
      } else {
        await supabase.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', session.user.id);
        userStatus = 'active';
      }
    } else if (usersDisabled && userRole === 'user') {
      shouldBeKicked = true;
      kickReason = 'account_type_disabled';
    } else if (adminsDisabled && userRole === 'admin') {
      shouldBeKicked = true;
      kickReason = 'account_type_disabled';
    }

    if (shouldBeKicked && !isPublicPath) {
      await supabase.auth.signOut();
      const finalRedirectUrl = new URL('/login', req.nextUrl.origin); // Redirect to login page
      finalRedirectUrl.searchParams.set('error', kickReason);
      if (kickedAt) {
        finalRedirectUrl.searchParams.set('kicked_at', kickedAt);
      }
      return NextResponse.redirect(finalRedirectUrl);
    }
  }

  // If authenticated and trying to access an auth-only path (like /login), redirect to /app
  if (session && authRoutes.includes(req.nextUrl.pathname)) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/app';
    return NextResponse.redirect(redirectUrl);
  }

  // If not authenticated and trying to access /app, redirect to /login
  if (!session && req.nextUrl.pathname.startsWith('/app')) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set(`redirectedFrom`, req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If not authenticated and not a public path, redirect to /login
  if (!session && !isPublicPath && !req.nextUrl.pathname.startsWith('/app')) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login'; // Redirect to login page
    redirectUrl.searchParams.set(`redirectedFrom`, req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};