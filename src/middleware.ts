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
  let kickedAt: string | null = null; // NEW: Fetch kicked_at

  if (session?.user?.id) {
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
      userStatus = 'active';
    } else {
      const { data: profile } = await supabase.from('profiles').select('role, status, kicked_at').eq('id', session.user.id).single(); // NEW: Select kicked_at
      userRole = profile ? profile.role as 'user' | 'admin' | 'super_admin' : 'user';
      userStatus = profile ? profile.status as 'active' | 'banned' | 'kicked' : 'active';
      kickedAt = profile?.kicked_at || null; // NEW: Assign kickedAt
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
    let shouldBeKicked = false;
    let kickReason = '';

    if (userStatus === 'banned') {
      shouldBeKicked = true;
      kickReason = 'account_banned';
    } else if (userStatus === 'kicked') {
      const kickedTime = kickedAt ? new Date(kickedAt).getTime() : 0;
      const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000); // 15 minutes in milliseconds

      if (kickedTime > fifteenMinutesAgo) {
        shouldBeKicked = true;
        kickReason = 'account_kicked';
      } else {
        // If kicked status has expired, automatically unkick the user
        console.log(`[Middleware] User ${session.user.id} was kicked, but 15 minutes have passed. Auto-unkicking.`);
        await supabase.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', session.user.id);
        // Also update auth.users metadata to clear any kicked_at flag
        await supabase.auth.admin.updateUserById(session.user.id, { user_metadata: { kicked_at: null } });
        userStatus = 'active'; // Update local status for current request
      }
    } else if (usersDisabled && userRole === 'user') {
      shouldBeKicked = true;
      kickReason = 'account_type_disabled';
    } else if (adminsDisabled && userRole === 'admin') {
      shouldBeKicked = true;
      kickReason = 'account_type_disabled';
    }

    if (shouldBeKicked && !publicPaths.includes(req.nextUrl.pathname)) {
      console.log(`[Middleware] User ${session.user.id} (Role: ${userRole}, Status: ${userStatus}) should be kicked. Redirecting to /login with error: ${kickReason}`);
      await supabase.auth.signOut();
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('error', kickReason);
      // Fetch the reason from moderation_logs if it's a specific kick/ban
      if (kickReason === 'account_kicked' || kickReason === 'account_banned') {
        const { data: moderationLog } = await supabase
          .from('moderation_logs')
          .select('reason')
          .eq('target_user_id', session.user.id)
          .eq('action', kickReason === 'account_kicked' ? 'kick' : 'ban')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (moderationLog?.reason) {
          redirectUrl.searchParams.set('reason', moderationLog.reason);
        }
        if (kickedAt) {
          redirectUrl.searchParams.set('kicked_at', kickedAt);
        }
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (!session && !publicPaths.includes(req.nextUrl.pathname)) {
    console.log(`[Middleware] No session found. Redirecting to /login from ${req.nextUrl.pathname}`);
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