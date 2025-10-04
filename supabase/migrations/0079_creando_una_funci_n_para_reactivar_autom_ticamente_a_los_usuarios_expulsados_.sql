CREATE OR REPLACE FUNCTION public.auto_unkick_users()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    unkicked_count integer;
BEGIN
    -- Actualizar perfiles de 'kicked' a 'active' si han pasado 15 minutos
    WITH users_to_unkick AS (
        SELECT id FROM public.profiles
        WHERE status = 'kicked' AND kicked_at < (now() - interval '15 minutes')
    )
    UPDATE public.profiles
    SET status = 'active', kicked_at = NULL
    WHERE id IN (SELECT id FROM users_to_unkick);

    GET DIAGNOSTICS unkicked_count = ROW_COUNT;

    -- No es necesario actualizar auth.users aquí, el middleware manejará el re-login.
    
    RETURN unkicked_count;
END;
$$;