-- 028_admin_role_policies.sql
-- Rol de admin basado en profiles.rol + políticas de lectura/gestión para el panel Admin.
-- Aplicado en producción vía Management API; este archivo lo documenta/reproduce.

-- Helper: ¿el usuario actual es admin? (rol = 'admin' en profiles)
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(rol) = 'admin'
  );
$$;

-- subscriptions: el admin puede ver/crear/editar/cancelar todas (los usuarios solo ven la suya).
drop policy if exists "admin_all_subscriptions" on public.subscriptions;
create policy "admin_all_subscriptions" on public.subscriptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- enrollments: el admin puede leer las de todos (los usuarios mantienen solo las suyas).
drop policy if exists "admin_select_enrollments" on public.enrollments;
create policy "admin_select_enrollments" on public.enrollments
  for select to authenticated
  using (public.is_admin());

-- Normalización de casing del campo profiles.tipo (p.ej. 'alumno' -> 'Alumno').
update public.profiles
set tipo = initcap(tipo)
where tipo is not null and tipo <> initcap(tipo);
