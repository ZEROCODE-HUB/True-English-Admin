-- Tabla para almacenar los tokens de push de los dispositivos de los usuarios.
-- La app móvil debe insertar/actualizar filas aquí al registrar el token de Expo.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, token)
);

create index if not exists push_tokens_profile_id_idx on public.push_tokens(profile_id);

alter table public.push_tokens enable row level security;

-- El propio usuario puede gestionar sus tokens; los admins también.
create policy "Usuarios gestionan sus tokens"
  on public.push_tokens for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Admins lectura push_tokens"
  on public.push_tokens for select
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));
