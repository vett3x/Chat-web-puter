-- Crear la tabla user_servers
-- ADVERTENCIA DE SEGURIDAD: ssh_password se almacena en texto plano.
-- En un entorno de producción, se recomienda encarecidamente cifrar esta columna.
create table public.user_servers (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text,
  ip_address text not null,
  ssh_port integer not null default 22,
  ssh_username text not null,
  ssh_password text not null, -- Cambiado de encrypted_ssh_password a ssh_password (texto plano)
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone,

  constraint user_servers_pkey primary key (id),
  constraint user_servers_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

-- Habilitar Row Level Security (RLS)
alter table public.user_servers enable row level security;

-- Políticas de RLS para la tabla user_servers
-- Permitir a los usuarios ver sus propios servidores
create policy "Users can view their own servers."
on public.user_servers for select
using (auth.uid() = user_id);

-- Permitir a los usuarios insertar sus propios servidores
create policy "Users can insert their own servers."
on public.user_servers for insert
with check (auth.uid() = user_id);

-- Permitir a los usuarios actualizar sus propios servidores
create policy "Users can update their own servers."
on public.user_servers for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Permitir a los usuarios eliminar sus propios servidores
create policy "Users can delete their own servers."
on public.user_servers for delete
using (auth.uid() = user_id);