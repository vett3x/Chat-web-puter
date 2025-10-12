export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createCloudflareDnsRecord } from '@/lib/cloudflare-utils';

const registerSchema = z.object({
  domain: z.string().min(1),
  appId: z.string().uuid(),
});

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => req.cookies.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { domain, appId } = registerSchema.parse(body);

    // 1. Fetch all necessary credentials and app details in parallel
    const [registrarRes, appRes] = await Promise.all([
      supabaseAdmin.from('domain_registrars').select('*').eq('is_active', true).eq('status', 'verified').single(),
      supabaseAdmin.from('user_apps').select('id, user_id, tunnel_id, docker_tunnels(full_domain, cloudflare_domain_id)').eq('id', appId).eq('user_id', session.user.id).single(),
    ]);

    if (registrarRes.error || !registrarRes.data) throw new Error('No se encontró un registrador de dominios activo y verificado.');
    if (appRes.error || !appRes.data) throw new Error('Aplicación no encontrada o acceso denegado.');
    
    const registrar = registrarRes.data;
    const app = appRes.data;
    const tunnel = Array.isArray(app.docker_tunnels) ? app.docker_tunnels[0] : app.docker_tunnels;

    if (!tunnel || !tunnel.full_domain || !tunnel.cloudflare_domain_id) {
      throw new Error('La aplicación no tiene un túnel de Cloudflare configurado correctamente.');
    }

    const { data: cfDomain, error: cfError } = await supabaseAdmin.from('cloudflare_domains').select('*').eq('id', tunnel.cloudflare_domain_id).single();
    if (cfError || !cfDomain) throw new Error('No se encontró la configuración de Cloudflare para este dominio.');

    // 2. Register domain with Dinahosting
    const registerUrl = `https://dinahosting.com/special/api.php?user=${registrar.api_username}&password=${registrar.api_password}&command=domain_register&domain_name=${domain}`;
    const registerResponse = await fetch(registerUrl);
    const registerText = await registerResponse.text();
    const registerCode = parseInt(registerText.split(' ')[0], 10);

    if (registerCode !== 200) {
      const errorMessage = registerText.substring(registerText.indexOf(' ') + 1);
      throw new Error(`Error al registrar el dominio en Dinahosting: ${errorMessage}`);
    }

    // 3. Create CNAME record in Cloudflare
    await createCloudflareDnsRecord(
      cfDomain.api_token,
      cfDomain.zone_id,
      domain,
      tunnel.full_domain, // Point the new domain to the app's tunnel URL
      session.user.id
    );

    // 4. Update the app record with the new custom domain
    const { error: updateAppError } = await supabaseAdmin
      .from('user_apps')
      .update({ custom_domain: domain })
      .eq('id', appId);

    if (updateAppError) {
      // This is a critical state: domain is registered but not linked. Log it.
      console.error(`[CRITICAL] Failed to link domain ${domain} to app ${appId} after registration. Error: ${updateAppError.message}`);
      throw new Error('Dominio registrado, pero hubo un error al vincularlo a tu aplicación. Por favor, contacta a soporte.');
    }

    return NextResponse.json({ message: `¡Dominio ${domain} registrado y configurado exitosamente!` });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API /domains/register] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}