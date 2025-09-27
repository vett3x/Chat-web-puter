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
  let userStatus: 'active' | 'banned' | 'kicked' | null = null; // NEW: Fetch user status

  if (session?.user?.id) {
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
      userStatus = 'active'; // Super admins are always active
    } else {
      const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', session.user.id).single();
      userRole = profile ? profile.role as 'user' | 'admin' | 'super_admin' : 'user';
      userStatus = profile ? profile.status as 'active' | 'banned' | 'kicked' : 'active'; // NEW: Get status from profile
    }
  }

  const { data: globalSettings } = await supabase.from('global_settings').select('maintenance_mode_enabled, users_disabled, admins_disabled').single();

  const maintenanceModeEnabled = globalSettings?.maintenance_mode_enabled ?? false;
  const usersDisabled = globalSettings?.users_disabled ?? false;
  const adminsDisabled = globalSettings?.admins_disabled ?? false;
  const isSuperAdmin = userRole === 'super_admin';

  const publicPaths = ['/login', '/maintenance'];

  if (maintenanceModeEnabled && !isSuperAdmin && !publicPaths.includes(req.nextUrl.pathname)) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/maintenance';
    return NextResponse.redirect(redirectUrl);
  }

  if (!maintenanceModeEnabled && req.nextUrl.pathname === '/maintenance') {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  // NEW: Kick and disable logic
  if (session && !isSuperAdmin) {
    const shouldBeKicked = (usersDisabled && userRole === 'user') || (adminsDisabled && userRole === 'admin') || userStatus === 'banned' || userStatus === 'kicked'; // NEW: Check for banned/kicked status
    if (shouldBeKicked && !publicPaths.includes(req.nextUrl.pathname)) {
      await supabase.auth.signOut();
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('error', userStatus === 'banned' ? 'account_banned' : (userStatus === 'kicked' ? 'account_kicked' : 'account_type_disabled')); // NEW: Specific error messages
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (!session && !publicPaths.includes(req.nextUrl.pathname)) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
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