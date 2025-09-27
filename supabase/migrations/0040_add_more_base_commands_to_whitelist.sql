INSERT INTO public.allowed_commands (command, description)
VALUES
    ('pkill', 'Permite terminar procesos específicos como npm run dev o cloudflared.'),
    ('apt-get', 'Permite la gestión de paquetes en sistemas Debian/Ubuntu.'),
    ('curl', 'Permite la descarga de archivos y la realización de solicitudes HTTP.'),
    ('sudo', 'Permite ejecutar comandos con privilegios de superusuario (sujeto a validación adicional).')
ON CONFLICT (command) DO NOTHING;