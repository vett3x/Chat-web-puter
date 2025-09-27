INSERT INTO public.allowed_commands (command, description)
VALUES
    ('npm', 'Node Package Manager: para instalar y gestionar dependencias de Node.js.'),
    ('npx', 'Node Package Execute: para ejecutar paquetes de Node.js.'),
    ('cd', 'Change Directory: para navegar entre directorios.'),
    ('nohup', 'No Hang Up: para ejecutar comandos en segundo plano, inmune a cuelgues o cierres de terminal.'),
    ('ls', 'List: para listar el contenido de un directorio.'),
    ('pwd', 'Print Working Directory: para mostrar el directorio de trabajo actual.'),
    ('which', 'para localizar un comando.'),
    ('cat', 'Concatenate: para mostrar el contenido de archivos.'),
    ('grep', 'Global Regular Expression Print: para buscar patrones en texto.'),
    ('sed', 'Stream Editor: para filtrar y transformar texto.'),
    ('awk', 'para procesar y analizar texto.'),
    ('tee', 'para leer de la entrada estándar y escribir en la salida estándar y en archivos.'),
    ('chmod', 'Change Mode: para cambiar permisos de archivos.'),
    ('install', 'para copiar archivos y establecer atributos.'),
    ('mkdir', 'Make Directory: para crear directorios.'),
    ('rm', 'Remove: para eliminar archivos o directorios (sujeto a validación de ruta segura).'),
    ('dirname', 'para extraer el nombre del directorio de una ruta.'),
    ('ss', 'Socket Statistics: para inspeccionar sockets (usado para verificar puertos).'),
    ('df', 'Disk Free: para mostrar el uso del espacio en disco.'),
    ('free', 'para mostrar el uso de memoria.'),
    ('top', 'para mostrar procesos en ejecución y uso de recursos.')
ON CONFLICT (command) DO NOTHING;