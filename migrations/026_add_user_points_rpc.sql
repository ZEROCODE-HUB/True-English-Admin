-- Migration: 026_add_user_points_rpc.sql
-- Purpose: RPC to atomically award points to the authenticated user's profile.
-- Used by the mobile app when a user passes a lesson quiz or a challenge.

create or replace function public.add_user_points(p_delta integer)
returns void
language sql
security definer
set search_path = public
as $func$
  update public.profiles set puntos = coalesce(puntos, 0) + p_delta where id = auth.uid();
$func$;

grant execute on function public.add_user_points(integer) to authenticated;
