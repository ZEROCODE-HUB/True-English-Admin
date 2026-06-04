-- 029_email_access_status.sql
-- RPC para que el panel Admin sepa si un email ya es usuario y si tiene acceso.
-- Permite invitar a usuarios que YA existen (p. ej. entraron con Google) pero
-- que todavía no tienen acceso (sin hasStudentCode / studentCode / paidPlanId).
-- Restringido a admins (public.is_admin()). Aplicado en producción vía
-- Management API; este archivo lo documenta/reproduce.

create or replace function public.email_access_status(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_access boolean;
begin
  if not public.is_admin() then
    raise exception 'forbidden: solo admin';
  end if;

  select exists(select 1 from auth.users where lower(email) = lower(p_email))
    into v_exists;

  select exists(
    select 1 from auth.users u
    where lower(u.email) = lower(p_email)
      and (
        (u.raw_user_meta_data->>'hasStudentCode') = 'true'
        or coalesce(u.raw_user_meta_data->>'studentCode', '') <> ''
        or coalesce(u.raw_user_meta_data->>'paidPlanId', '') <> ''
      )
  ) into v_access;

  return jsonb_build_object('exists', v_exists, 'has_access', v_access);
end;
$$;

grant execute on function public.email_access_status(text) to authenticated;
