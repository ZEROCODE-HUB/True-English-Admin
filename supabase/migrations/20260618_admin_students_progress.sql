-- RPC para el panel admin: avance de alumnos (puntos, % avance por nivel, horas, racha, logros).
-- SECURITY DEFINER + guard is_admin() porque el admin usa anon key y varias tablas
-- (user_daily_foreground, user_achievements) solo tienen RLS "own row".
create or replace function public.admin_get_students_progress()
returns table (
  id uuid,
  name text,
  last_name text,
  email text,
  company text,
  nivel_actual text,
  status text,
  tipo text,
  created_at timestamptz,
  puntos int,
  completed_total int,
  lessons_total int,
  completed_in_level int,
  lessons_in_level int,
  pct_avance int,
  horas_totales_ms numeric,
  horas_mes_ms numeric,
  streak_count int,
  streak_best int,
  logros_count int,
  ultima_actividad date
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;

  return query
  select
    p.id,
    p.name,
    p.last_name,
    p.email,
    p.company,
    p.nivel_actual::text,
    p.status,
    p.tipo,
    p.created_at,
    coalesce(p.puntos, 0)::int,
    coalesce(comp.completed_total, 0)::int,
    (select count(*) from lessons)::int,
    coalesce(comp.completed_in_level, 0)::int,
    coalesce(lt.cnt, 0)::int,
    case when coalesce(lt.cnt, 0) > 0
         then round(coalesce(comp.completed_in_level, 0)::numeric / lt.cnt * 100)::int
         else 0 end,
    coalesce(tf.total_ms, 0),
    coalesce(mf.month_ms, 0),
    coalesce(p.streak_count, 0),
    coalesce(p.streak_best, 0),
    coalesce(ach.cnt, 0)::int,
    af.last_day
  from profiles p
  left join (
    select level::text as lvl, count(*) as cnt
    from lessons
    group by level
  ) lt on lt.lvl = p.nivel_actual::text
  left join (
    select
      e.profile_id,
      count(*) filter (where e.status = 'completed') as completed_total,
      count(*) filter (where e.status = 'completed' and l.level::text = pr.nivel_actual::text) as completed_in_level
    from enrollments e
    join profiles pr on pr.id = e.profile_id
    left join lessons l on l.id = e.lesson_id
    group by e.profile_id
  ) comp on comp.profile_id = p.id
  left join (
    select user_id, sum(total_ms) as total_ms
    from user_daily_foreground
    group by user_id
  ) tf on tf.user_id = p.id
  left join (
    select user_id, sum(total_ms) as month_ms
    from user_daily_foreground
    where day >= date_trunc('month', current_date)::date
    group by user_id
  ) mf on mf.user_id = p.id
  left join (
    select user_id, max(day) as last_day
    from user_daily_foreground
    group by user_id
  ) af on af.user_id = p.id
  left join (
    select user_id, count(*) as cnt
    from user_achievements
    group by user_id
  ) ach on ach.user_id = p.id
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_get_students_progress() to authenticated;
